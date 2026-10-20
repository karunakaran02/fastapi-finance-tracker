import calendar
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import re
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session
from app.models.category import Category
from app.models.recurring import RecurringItem
from app.models.stream import StreamBook, StreamEntry
from app.models.transaction import Transaction
from app.schemas.recurring import (
    CashRunwayForecast,
    DailyForecastPoint,
    RecurringCreate,
    RecurringFrequency,
    RecurringResponse,
    RecurringSuggestion,
    RecurringUpdate,
    UpcomingMilestone,
)

def clean_name(val: Optional[str]) -> str:
    if not val:
        return ""
    return re.sub(r"[^a-zA-Z0-9 ]", "", val).strip()

def matches_cadence(target_date: date, due_date: date, frequency: str) -> bool:
    if target_date < due_date:
        return False
    freq = frequency.upper()
    if target_date == due_date:
        return True
    if freq == "WEEKLY":
        return (target_date - due_date).days % 7 == 0
    if freq == "BIWEEKLY":
        return (target_date - due_date).days % 14 == 0
    if freq == "MONTHLY":
        max_day = calendar.monthrange(target_date.year, target_date.month)[1]
        target_effective_day = min(due_date.day, max_day)
        months_diff = (target_date.year - due_date.year) * 12 + (target_date.month - due_date.month)
        return months_diff > 0 and target_date.day == target_effective_day
    if freq == "YEARLY":
        max_day = calendar.monthrange(target_date.year, due_date.month)[1]
        target_effective_day = min(due_date.day, max_day)
        return (
            target_date.year > due_date.year
            and target_date.month == due_date.month
            and target_date.day == target_effective_day
        )
    return False

def get_monthly_equivalent(amount: Decimal, frequency: str) -> Decimal:
    freq = frequency.upper()
    if freq == "WEEKLY":
        return (amount * Decimal(52)) / Decimal(12)
    if freq == "BIWEEKLY":
        return (amount * Decimal(26)) / Decimal(12)
    if freq == "YEARLY":
        return amount / Decimal(12)
    return amount

def to_response(item: RecurringItem) -> RecurringResponse:
    now_utc = datetime.now(timezone.utc).date()
    item_due = item.next_due_date.date() if isinstance(item.next_due_date, datetime) else item.next_due_date
    days_left = (item_due - now_utc).days

    return RecurringResponse(
        id=item.id,
        user_id=item.user_id,
        book_id=item.book_id,
        book_title=item.book.title if item.book else None,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
        name=item.name,
        type=item.type.lower(),
        amount=Decimal(str(item.amount)),
        frequency=item.frequency.lower(),
        next_due_date=item.next_due_date,
        status=item.status.lower(),
        auto_log=item.auto_log,
        notes=item.notes,
        days_until_due=days_left,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )

def list_recurring(
    db: Session,
    user_id: int,
    status: Optional[str] = None,
    book_id: Optional[int] = None,
) -> List[RecurringResponse]:
    query = db.query(RecurringItem).filter(RecurringItem.user_id == user_id)
    if status:
        query = query.filter(RecurringItem.status == status.upper())
    if book_id is not None:
        query = query.filter(RecurringItem.book_id == book_id)
    items = query.order_by(RecurringItem.next_due_date.asc()).all()
    return [to_response(i) for i in items]

def create_recurring(db: Session, user_id: int, payload: RecurringCreate) -> RecurringResponse:
    if payload.category_id is not None:
        cat = db.query(Category).filter(
            Category.id == payload.category_id,
            or_(Category.user_id == user_id, Category.user_id.is_(None)),
        ).first()
        if not cat:
            payload.category_id = None

    if payload.book_id is not None:
        book = db.query(StreamBook).filter(
            StreamBook.id == payload.book_id,
            StreamBook.user_id == user_id,
        ).first()
        if not book:
            payload.book_id = None

    db_item = RecurringItem(
        user_id=user_id,
        book_id=payload.book_id,
        category_id=payload.category_id,
        name=payload.name.strip(),
        type=payload.type.upper(),
        amount=payload.amount,
        frequency=payload.frequency.upper(),
        next_due_date=payload.next_due_date,
        status="ACTIVE",
        auto_log=payload.auto_log,
        notes=payload.notes,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return to_response(db_item)

def get_recurring(db: Session, user_id: int, item_id: int) -> Optional[RecurringResponse]:
    item = db.query(RecurringItem).filter(
        RecurringItem.id == item_id,
        RecurringItem.user_id == user_id,
    ).first()
    return to_response(item) if item else None

def update_recurring(
    db: Session,
    user_id: int,
    item_id: int,
    payload: RecurringUpdate,
) -> Optional[RecurringResponse]:
    item = db.query(RecurringItem).filter(
        RecurringItem.id == item_id,
        RecurringItem.user_id == user_id,
    ).first()
    if not item:
        return None

    if payload.name is not None:
        item.name = payload.name.strip()
    if payload.amount is not None:
        item.amount = payload.amount
    if payload.type is not None:
        item.type = payload.type.upper()
    if payload.frequency is not None:
        item.frequency = payload.frequency.upper()
    if payload.next_due_date is not None:
        item.next_due_date = payload.next_due_date
    if payload.status is not None:
        item.status = payload.status.upper()
    if payload.auto_log is not None:
        item.auto_log = payload.auto_log
    if payload.notes is not None:
        item.notes = payload.notes
    if payload.category_id is not None:
        cat = db.query(Category).filter(
            Category.id == payload.category_id,
            or_(Category.user_id == user_id, Category.user_id.is_(None)),
        ).first()
        if cat:
            item.category_id = payload.category_id
    if payload.book_id is not None:
        book = db.query(StreamBook).filter(
            StreamBook.id == payload.book_id,
            StreamBook.user_id == user_id,
        ).first()
        if book:
            item.book_id = payload.book_id

    db.commit()
    db.refresh(item)
    return to_response(item)

def delete_recurring(db: Session, user_id: int, item_id: int) -> bool:
    item = db.query(RecurringItem).filter(
        RecurringItem.id == item_id,
        RecurringItem.user_id == user_id,
    ).first()
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True

def calculate_forecast(
    db: Session,
    user_id: int,
    days: int = 30,
    book_id: Optional[int] = None,
) -> CashRunwayForecast:
    days = max(7, min(days, 365))

    if book_id is not None:
        entries = db.query(StreamEntry).join(StreamBook).filter(
            StreamBook.id == book_id,
            StreamBook.user_id == user_id,
        ).all()
        inflow = sum((Decimal(str(e.amount)) for e in entries if e.type == "IN"), Decimal("0"))
        outflow = sum((Decimal(str(e.amount)) for e in entries if e.type == "OUT"), Decimal("0"))
        current_balance = inflow - outflow
    else:
        txs = db.query(Transaction).filter(Transaction.user_id == user_id).all()
        income = sum((Decimal(str(t.amount)) for t in txs if str(t.type).lower() == "income"), Decimal("0"))
        expense = sum((Decimal(str(t.amount)) for t in txs if str(t.type).lower() == "expense"), Decimal("0"))
        current_balance = income - expense

    req_query = db.query(RecurringItem).filter(
        RecurringItem.user_id == user_id,
        RecurringItem.status == "ACTIVE",
    )
    if book_id is not None:
        req_query = req_query.filter(RecurringItem.book_id == book_id)

    active_items = req_query.all()

    monthly_burn = Decimal("0")
    monthly_income = Decimal("0")

    for item in active_items:
        amt = Decimal(str(item.amount))
        eq = get_monthly_equivalent(amt, item.frequency)
        if item.type == "INCOME":
            monthly_income += eq
        else:
            monthly_burn += eq

    net_monthly = monthly_income - monthly_burn

    runway_days: Optional[int] = None
    if monthly_burn > monthly_income:
        net_burn = monthly_burn - monthly_income
        if current_balance <= 0:
            runway_days = 0
            runway_status = "critical"
        else:
            calc_days = int((current_balance / net_burn) * Decimal(30))
            runway_days = min(calc_days, 9999)
            if runway_days < 30:
                runway_status = "critical"
            elif runway_days < 90:
                runway_status = "moderate"
            else:
                runway_status = "healthy"
    else:
        runway_days = None
        runway_status = "infinite_growth"

    now_utc = datetime.now(timezone.utc).date()
    running_balance = current_balance

    daily_timeline: List[DailyForecastPoint] = []
    upcoming_milestones: List[UpcomingMilestone] = []
    upcoming_7_count = 0
    upcoming_7_total = Decimal("0")
    upcoming_30_count = 0
    upcoming_30_total = Decimal("0")

    seen_milestone_keys: Set[Tuple[int, date]] = set()

    for d_idx in range(days):
        target_date = now_utc + timedelta(days=d_idx)
        day_income = Decimal("0")
        day_expense = Decimal("0")
        day_events: List[str] = []

        for item in active_items:
            item_due = item.next_due_date.date() if isinstance(item.next_due_date, datetime) else item.next_due_date
            if matches_cadence(target_date, item_due, item.frequency):
                amt = Decimal(str(item.amount))
                if item.type == "INCOME":
                    day_income += amt
                    day_events.append(f"{item.name}: +{amt:,.2f}")
                else:
                    day_expense += amt
                    day_events.append(f"{item.name}: -{amt:,.2f}")

                m_key = (item.id, target_date)
                if m_key not in seen_milestone_keys:
                    seen_milestone_keys.add(m_key)
                    days_diff = (target_date - now_utc).days
                    upcoming_milestones.append(
                        UpcomingMilestone(
                            id=item.id,
                            name=item.name,
                            amount=amt,
                            type=item.type.lower(),
                            due_date=datetime.combine(target_date, time.min, timezone.utc),
                            days_until_due=days_diff,
                            frequency=item.frequency.lower(),
                            category_name=item.category.name if item.category else None,
                            book_title=item.book.title if item.book else None,
                            status=item.status.lower(),
                        )
                    )
                    if item.type == "EXPENSE":
                        if days_diff <= 7:
                            upcoming_7_count += 1
                            upcoming_7_total += amt
                        if days_diff <= 30:
                            upcoming_30_count += 1
                            upcoming_30_total += amt

        running_balance = running_balance + day_income - day_expense

        daily_timeline.append(
            DailyForecastPoint(
                date=target_date.strftime("%Y-%m-%d"),
                day_name=target_date.strftime("%a"),
                projected_balance=running_balance.quantize(Decimal("0.01")),
                income_delta=day_income.quantize(Decimal("0.01")),
                expense_delta=day_expense.quantize(Decimal("0.01")),
                events=day_events,
            )
        )

    upcoming_milestones.sort(key=lambda m: (m.days_until_due, m.name))

    return CashRunwayForecast(
        days_forecasted=days,
        current_liquid_balance=current_balance.quantize(Decimal("0.01")),
        projected_end_balance=running_balance.quantize(Decimal("0.01")),
        monthly_recurring_burn=monthly_burn.quantize(Decimal("0.01")),
        monthly_recurring_income=monthly_income.quantize(Decimal("0.01")),
        net_monthly_recurring=net_monthly.quantize(Decimal("0.01")),
        runway_days=runway_days,
        runway_status=runway_status,
        upcoming_7_days_count=upcoming_7_count,
        upcoming_7_days_total=upcoming_7_total.quantize(Decimal("0.01")),
        upcoming_30_days_count=upcoming_30_count,
        upcoming_30_days_total=upcoming_30_total.quantize(Decimal("0.01")),
        daily_timeline=daily_timeline,
        upcoming_milestones=upcoming_milestones[:25],
    )

def detect_suggestions(db: Session, user_id: int) -> List[RecurringSuggestion]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    txs = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.transaction_date >= cutoff,
        Transaction.type == "expense",
    ).order_by(Transaction.transaction_date.asc()).all()

    existing_names = {
        clean_name(r.name).lower()
        for r in db.query(RecurringItem.name).filter(RecurringItem.user_id == user_id).all()
    }

    grouped: Dict[str, List[Transaction]] = {}
    for t in txs:
        desc_clean = clean_name(t.description or "")
        if len(desc_clean) < 3:
            continue
        key = desc_clean.lower()
        if key in existing_names:
            continue
        grouped.setdefault(key, []).append(t)

    suggestions: List[RecurringSuggestion] = []

    for name_key, items in grouped.items():
        if len(items) < 2:
            continue

        amounts = [Decimal(str(i.amount)) for i in items]
        avg_amt = sum(amounts) / Decimal(len(amounts))

        is_consistent = all(abs(a - avg_amt) <= (avg_amt * Decimal("0.10") + Decimal("2.00")) for a in amounts)
        if not is_consistent:
            continue

        dates = sorted([i.transaction_date.date() for i in items])
        intervals = [(dates[idx] - dates[idx - 1]).days for idx in range(1, len(dates))]
        avg_interval = sum(intervals) / len(intervals)

        if 5 <= avg_interval <= 9:
            freq: RecurringFrequency = "weekly"
            est_monthly = avg_amt * Decimal(52) / Decimal(12)
        elif 12 <= avg_interval <= 16:
            freq = "biweekly"
            est_monthly = avg_amt * Decimal(26) / Decimal(12)
        elif 25 <= avg_interval <= 35:
            freq = "monthly"
            est_monthly = avg_amt
        else:
            continue

        cat_id = items[-1].category_id
        cat_name = items[-1].category.name if items[-1].category else None

        display_name = items[-1].description or name_key.title()

        suggestions.append(
            RecurringSuggestion(
                name=display_name.strip()[:64],
                detected_amount=avg_amt.quantize(Decimal("0.01")),
                frequency=freq,
                estimated_monthly=est_monthly.quantize(Decimal("0.01")),
                occurrences_count=len(items),
                category_id=cat_id,
                category_name=cat_name,
                sample_dates=[d.strftime("%Y-%m-%d") for d in dates[-3:]],
            )
        )

    suggestions.sort(key=lambda s: s.estimated_monthly, reverse=True)
    return suggestions[:10]
