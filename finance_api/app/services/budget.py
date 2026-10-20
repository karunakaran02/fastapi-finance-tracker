import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.database import session as session_module
from app.models.budget import AlertNotification, Budget
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.budget import (
    AlertNotificationResponse,
    BudgetCreate,
    BudgetOverviewResponse,
    BudgetResponse,
    BudgetUpdate,
)
from app.services.email import send_threshold_alert_email

logger = logging.getLogger("finance_api.budget")

def _calculate_budget_current_volume(
    db: Session,
    user_id: int,
    budget_type: str,
    category_id: Optional[int],
    start_of_month: datetime,
    end_of_month: datetime,
) -> Decimal:
    query = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == budget_type,
            Transaction.transaction_date >= start_of_month,
            Transaction.transaction_date <= end_of_month,
        )
    )
    if category_id is not None:
        query = query.filter(Transaction.category_id == category_id)

    total = query.scalar()
    return Decimal(str(total or "0.00"))

def _format_budget_response(budget: Budget, current_volume: Decimal) -> BudgetResponse:
    threshold = Decimal(str(budget.threshold_amount))
    pct = float(round((current_volume / threshold) * Decimal("100.0"), 1)) if threshold > Decimal("0.00") else 0.0
    remaining = max(threshold - current_volume, Decimal("0.00"))
    is_exceeded = current_volume >= threshold and threshold > Decimal("0.00")

    if is_exceeded:
        status = "exceeded"
    elif pct >= 80.0:
        status = "warning"
    else:
        status = "safe"

    cat_name = budget.category.name if budget.category else None
    notif_count = len(budget.notifications) if budget.notifications else 0

    return BudgetResponse(
        id=budget.id,
        user_id=budget.user_id,
        category_id=budget.category_id,
        category_name=cat_name,
        name=budget.name,
        type=budget.type,
        threshold_amount=threshold,
        period=budget.period,
        alert_email=budget.alert_email,
        is_active=budget.is_active,
        last_triggered_at=budget.last_triggered_at,
        created_at=budget.created_at,
        updated_at=budget.updated_at,
        current_amount=current_volume,
        percentage_used=pct,
        remaining_amount=remaining,
        is_exceeded=is_exceeded,
        status=status,
        notification_count=notif_count,
    )

def get_single_budget_with_analytics(db: Session, budget: Budget) -> BudgetResponse:
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    end_of_month = (
        datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        if now.month == 12
        else datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    )
    current_vol = _calculate_budget_current_volume(
        db=db,
        user_id=budget.user_id,
        budget_type=budget.type,
        category_id=budget.category_id,
        start_of_month=start_of_month,
        end_of_month=end_of_month,
    )
    return _format_budget_response(budget, current_vol)

def get_budgets_with_analytics(db: Session, user_id: int) -> List[BudgetResponse]:
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    end_of_month = (
        datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        if now.month == 12
        else datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    )

    budgets = (
        db.query(Budget)
        .options(joinedload(Budget.category), joinedload(Budget.notifications))
        .filter(Budget.user_id == user_id)
        .order_by(desc(Budget.is_active), Budget.name.asc())
        .all()
    )

    if not budgets:
        return []

    aggregated_spends = (
        db.query(
            Transaction.type,
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total"),
        )
        .filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= start_of_month,
            Transaction.transaction_date <= end_of_month,
        )
        .group_by(Transaction.type, Transaction.category_id)
        .all()
    )

    volume_by_category: Dict[tuple, Decimal] = {}
    volume_by_type: Dict[str, Decimal] = {"expense": Decimal("0.00"), "income": Decimal("0.00")}

    for tx_type, cat_id, total in aggregated_spends:
        dec_total = Decimal(str(total or "0.00"))
        if cat_id is not None:
            volume_by_category[(tx_type, cat_id)] = dec_total
        volume_by_type[tx_type] = volume_by_type.get(tx_type, Decimal("0.00")) + dec_total

    results: List[BudgetResponse] = []
    for b in budgets:
        if b.category_id is not None:
            current_vol = volume_by_category.get((b.type, b.category_id), Decimal("0.00"))
        else:
            current_vol = volume_by_type.get(b.type, Decimal("0.00"))
        results.append(_format_budget_response(b, current_vol))

    return results

def get_budget_overview(db: Session, user_id: int) -> BudgetOverviewResponse:
    budgets_with_analytics = get_budgets_with_analytics(db, user_id)
    recent_notifs_models = (
        db.query(AlertNotification)
        .options(joinedload(AlertNotification.budget))
        .filter(AlertNotification.user_id == user_id)
        .order_by(desc(AlertNotification.sent_at))
        .limit(15)
        .all()
    )

    recent_notifications = [
        AlertNotificationResponse(
            id=n.id,
            user_id=n.user_id,
            budget_id=n.budget_id,
            budget_name=n.budget.name if n.budget else "Budget",
            transaction_id=n.transaction_id,
            recipient_email=n.recipient_email,
            subject=n.subject,
            message=n.message,
            threshold_amount=n.threshold_amount,
            current_amount=n.current_amount,
            exceeded_by=n.exceeded_by,
            sent_at=n.sent_at,
        )
        for n in recent_notifs_models
    ]

    total_budgets = len(budgets_with_analytics)
    active_budgets = sum(1 for b in budgets_with_analytics if b.is_active)
    exceeded_budgets = sum(1 for b in budgets_with_analytics if b.is_active and b.is_exceeded)
    warning_budgets = sum(1 for b in budgets_with_analytics if b.is_active and b.status == "warning")

    total_budgeted_expense = sum(
        (b.threshold_amount for b in budgets_with_analytics if b.is_active and b.type == "expense"),
        Decimal("0.00"),
    )
    total_spent_in_budgeted = sum(
        (b.current_amount for b in budgets_with_analytics if b.is_active and b.type == "expense"),
        Decimal("0.00"),
    )

    total_notifications_sent = (
        db.query(func.count(AlertNotification.id))
        .filter(AlertNotification.user_id == user_id)
        .scalar()
        or 0
    )

    return BudgetOverviewResponse(
        total_budgets=total_budgets,
        active_budgets=active_budgets,
        exceeded_budgets=exceeded_budgets,
        warning_budgets=warning_budgets,
        total_budgeted_expense=total_budgeted_expense,
        total_spent_in_budgeted=total_spent_in_budgeted,
        total_notifications_sent=total_notifications_sent,
        smtp_configured=bool(settings.SMTP_HOST),
        budgets=budgets_with_analytics,
        recent_notifications=recent_notifications,
    )

def create_budget(db: Session, user_id: int, budget_in: BudgetCreate) -> Budget:
    if budget_in.category_id is not None:
        cat = (
            db.query(Category)
            .filter(
                Category.id == budget_in.category_id,
                (Category.user_id == user_id) | (Category.is_system == True),
            )
            .first()
        )
        if not cat:
            raise ValueError(f"Category with ID {budget_in.category_id} not found.")
        if cat.type != budget_in.type:
            raise ValueError(
                f"Category '{cat.name}' type is '{cat.type}', which does not match budget type '{budget_in.type}'."
            )

    budget = Budget(
        user_id=user_id,
        category_id=budget_in.category_id,
        name=budget_in.name.strip(),
        type=budget_in.type,
        threshold_amount=budget_in.threshold_amount,
        period=budget_in.period,
        alert_email=str(budget_in.alert_email).strip() if budget_in.alert_email else None,
        is_active=budget_in.is_active,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget

def update_budget(db: Session, budget: Budget, budget_in: BudgetUpdate) -> Budget:
    update_data = budget_in.model_dump(exclude_unset=True)

    if "category_id" in update_data and update_data["category_id"] is not None:
        cat = (
            db.query(Category)
            .filter(
                Category.id == update_data["category_id"],
                (Category.user_id == budget.user_id) | (Category.is_system == True),
            )
            .first()
        )
        if not cat:
            raise ValueError(f"Category with ID {update_data['category_id']} not found.")
        if cat.type != budget.type:
            raise ValueError(
                f"Category '{cat.name}' type is '{cat.type}', which does not match budget type '{budget.type}'."
            )

    for field, val in update_data.items():
        if field == "name" and val:
            setattr(budget, field, val.strip())
        elif field == "alert_email" and val:
            setattr(budget, field, str(val).strip())
        else:
            setattr(budget, field, val)

    db.commit()
    db.refresh(budget)
    return budget

def delete_budget(db: Session, budget: Budget) -> None:
    db.delete(budget)
    db.commit()

def evaluate_and_trigger_alerts_background(
    user_id: int,
    transaction_ids: Optional[List[int]] = None,
) -> int:
    db = session_module.SessionLocal()
    triggered_count = 0
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            return 0

        budgets = (
            db.query(Budget)
            .options(joinedload(Budget.category))
            .filter(Budget.user_id == user_id, Budget.is_active == True)
            .all()
        )
        if not budgets:
            return 0

        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 12:
            end_of_month = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_of_month = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)

        new_txs: List[Transaction] = []
        if transaction_ids:
            new_txs = (
                db.query(Transaction)
                .options(joinedload(Transaction.category))
                .filter(Transaction.id.in_(transaction_ids), Transaction.user_id == user_id)
                .all()
            )

        aggregated_spends = (
            db.query(
                Transaction.type,
                Transaction.category_id,
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start_of_month,
                Transaction.transaction_date <= end_of_month,
            )
            .group_by(Transaction.type, Transaction.category_id)
            .all()
        )
        volume_by_category: Dict[tuple, Decimal] = {}
        volume_by_type: Dict[str, Decimal] = {"expense": Decimal("0.00"), "income": Decimal("0.00")}
        for tx_type, cat_id, total in aggregated_spends:
            dec_total = Decimal(str(total or "0.00"))
            if cat_id is not None:
                volume_by_category[(tx_type, cat_id)] = dec_total
            volume_by_type[tx_type] = volume_by_type.get(tx_type, Decimal("0.00")) + dec_total

        for b in budgets:
            recipient = b.alert_email or user.email
            threshold = Decimal(str(b.threshold_amount))
            cat_name = b.category.name if b.category else None

            if b.period == "per_transaction":
                for tx in new_txs:
                    if tx.type != b.type:
                        continue
                    if b.category_id is not None and tx.category_id != b.category_id:
                        continue
                    amt = Decimal(str(tx.amount))
                    if amt >= threshold and threshold > Decimal("0.00"):
                        exceeded = max(amt - threshold, Decimal("0.00"))
                        if exceeded > Decimal("0.00"):
                            subject = f"⚠️ Alert: Per-transaction {b.name} limit exceeded (₹{amt:,.2f})"
                            message = (
                                f"Transaction '{tx.description or 'Entry'}' of ₹{amt:,.2f} exceeded "
                                f"your per-transaction threshold of ₹{threshold:,.2f} by ₹{exceeded:,.2f}."
                            )
                        else:
                            subject = f"⚠️ Alert: Per-transaction {b.name} limit reached (₹{amt:,.2f})"
                            message = (
                                f"Transaction '{tx.description or 'Entry'}' of ₹{amt:,.2f} reached "
                                f"your per-transaction threshold of ₹{threshold:,.2f} (100% capacity)."
                            )

                        success, delivery_note = send_threshold_alert_email(
                            recipient_email=recipient,
                            budget_name=b.name,
                            budget_type=b.type,
                            category_name=cat_name,
                            threshold_amount=threshold,
                            current_amount=amt,
                            exceeded_by=exceeded,
                            transaction_desc=tx.description,
                            transaction_amount=amt,
                            period="single transaction",
                        )

                        notif = AlertNotification(
                            user_id=user_id,
                            budget_id=b.id,
                            transaction_id=tx.id,
                            recipient_email=recipient,
                            subject=subject,
                            message=f"{message} [{delivery_note}]",
                            threshold_amount=threshold,
                            current_amount=amt,
                            exceeded_by=exceeded,
                            sent_at=now,
                        )
                        db.add(notif)
                        b.last_triggered_at = now
                        triggered_count += 1

            else:
                if b.category_id is not None:
                    current_vol = volume_by_category.get((b.type, b.category_id), Decimal("0.00"))
                else:
                    current_vol = volume_by_type.get(b.type, Decimal("0.00"))

                if current_vol >= threshold and threshold > Decimal("0.00"):
                    exceeded = max(current_vol - threshold, Decimal("0.00"))

                    last_notif = (
                        db.query(AlertNotification)
                        .filter(
                            AlertNotification.budget_id == b.id,
                            AlertNotification.sent_at >= start_of_month,
                            ~AlertNotification.subject.like("%[TEST%"),
                        )
                        .order_by(desc(AlertNotification.sent_at))
                        .first()
                    )

                    should_alert = False
                    if not last_notif:
                        should_alert = True
                    else:
                        prev_vol = Decimal(str(last_notif.current_amount or "0.00"))
                        last_failed = "SMTP Delivery Failed" in (last_notif.message or "")
                        if last_failed or current_vol > prev_vol or current_vol >= (prev_vol + Decimal("500.00")):
                            should_alert = True

                    if should_alert:
                        latest_tx = new_txs[0] if new_txs else (
                            db.query(Transaction)
                            .filter(
                                Transaction.user_id == user_id,
                                Transaction.type == b.type,
                                (Transaction.category_id == b.category_id) if b.category_id else True,
                            )
                            .order_by(desc(Transaction.transaction_date), desc(Transaction.id))
                            .first()
                        )
                        tx_desc = latest_tx.description if latest_tx else None
                        tx_amt = Decimal(str(latest_tx.amount)) if latest_tx else None

                        if exceeded > Decimal("0.00"):
                            subject = f"⚠️ Alert: Monthly {b.name} limit exceeded (₹{current_vol:,.2f} / ₹{threshold:,.2f})"
                            message = (
                                f"Your recorded {b.type} volume of ₹{current_vol:,.2f} has exceeded "
                                f"your monthly budget threshold of ₹{threshold:,.2f} by ₹{exceeded:,.2f}."
                            )
                        else:
                            subject = f"⚠️ Alert: Monthly {b.name} limit reached (₹{current_vol:,.2f} / ₹{threshold:,.2f})"
                            message = (
                                f"Your recorded {b.type} volume of ₹{current_vol:,.2f} has reached "
                                f"100% of your monthly budget threshold of ₹{threshold:,.2f} (Remaining: ₹0.00)."
                            )

                        success, delivery_note = send_threshold_alert_email(
                            recipient_email=recipient,
                            budget_name=b.name,
                            budget_type=b.type,
                            category_name=cat_name,
                            threshold_amount=threshold,
                            current_amount=current_vol,
                            exceeded_by=exceeded,
                            transaction_desc=tx_desc,
                            transaction_amount=tx_amt,
                            period="monthly",
                        )

                        notif = AlertNotification(
                            user_id=user_id,
                            budget_id=b.id,
                            transaction_id=latest_tx.id if latest_tx else None,
                            recipient_email=recipient,
                            subject=subject,
                            message=f"{message} [{delivery_note}]",
                            threshold_amount=threshold,
                            current_amount=current_vol,
                            exceeded_by=exceeded,
                            sent_at=now,
                        )
                        db.add(notif)
                        b.last_triggered_at = now
                        triggered_count += 1

        db.commit()
    except Exception as exc:
        logger.error("Error during background alert evaluation for user %s: %s", user_id, exc)
        db.rollback()
    finally:
        db.close()

    return triggered_count

def trigger_test_alert(db: Session, user_id: int, budget: Budget) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    recipient = budget.alert_email or (user.email if user else "user@financeintel.com")
    cat_name = budget.category.name if budget.category else None
    threshold = Decimal(str(budget.threshold_amount))
    simulated_current = threshold * Decimal("1.15")
    exceeded = simulated_current - threshold

    success, delivery_note = send_threshold_alert_email(
        recipient_email=recipient,
        budget_name=f"[TEST] {budget.name}",
        budget_type=budget.type,
        category_name=cat_name,
        threshold_amount=threshold,
        current_amount=simulated_current,
        exceeded_by=exceeded,
        transaction_desc="Sample Verification Ledger Entry",
        transaction_amount=exceeded,
        period=budget.period,
    )

    notif = AlertNotification(
        user_id=user_id,
        budget_id=budget.id,
        transaction_id=None,
        recipient_email=recipient,
        subject=f"[TEST SIMULATION] {budget.name} Alert Verification",
        message=f"Manual test alert verified for threshold ₹{threshold:,.2f}. [{delivery_note}]",
        threshold_amount=threshold,
        current_amount=simulated_current,
        exceeded_by=exceeded,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(notif)
    db.commit()
    return success

def trigger_test_alert_background(user_id: int, budget_id: int) -> bool:
    db = session_module.SessionLocal()
    try:
        budget = (
            db.query(Budget)
            .options(joinedload(Budget.category))
            .filter(Budget.id == budget_id, Budget.user_id == user_id)
            .first()
        )
        if not budget:
            return False
        return trigger_test_alert(db, user_id, budget)
    finally:
        db.close()
