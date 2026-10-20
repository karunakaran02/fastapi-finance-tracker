from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import or_, cast, String
from sqlalchemy.orm import Session, joinedload

from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.report import (
    CategoryReportItem,
    CategoryReportResponse,
    DashboardResponse,
    MonthlyReportResponse,
    MonthlyTrendItem,
    SpendingByCategory,
)
from app.schemas.transaction import TransactionResponse

def _format_transaction_response(tx: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=tx.id,
        user_id=tx.user_id,
        book_id=tx.book_id,
        book_title=tx.book.title if tx.book else None,
        book_color=tx.book.color if tx.book else None,
        book_icon=tx.book.icon if tx.book else None,
        category_id=tx.category_id,
        category_name=tx.category.name if tx.category else None,
        type=tx.type,
        amount=tx.amount,
        description=tx.description,
        transaction_date=tx.transaction_date,
        created_at=tx.created_at,
        updated_at=tx.updated_at,
    )

def get_dashboard_analytics(
    db: Session,
    user_id: int,
    search: Optional[str] = None,
) -> DashboardResponse:
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    all_transactions = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.user_id == user_id)
        .all()
    )

    total_income = Decimal("0.00")
    total_expenses = Decimal("0.00")
    monthly_income = Decimal("0.00")
    monthly_expenses = Decimal("0.00")
    category_spending_map = {}

    for tx in all_transactions:
        amt = Decimal(str(tx.amount))
        tx_date = tx.transaction_date
        if tx_date.tzinfo is None:
            tx_date = tx_date.replace(tzinfo=timezone.utc)

        is_current_month = tx_date >= start_of_month

        if tx.type == "income":
            total_income += amt
            if is_current_month:
                monthly_income += amt
        elif tx.type == "expense":
            total_expenses += amt
            if is_current_month:
                monthly_expenses += amt

            cat_id = tx.category_id
            cat_name = tx.category.name if tx.category else "Uncategorized"
            if cat_id not in category_spending_map:
                category_spending_map[cat_id] = {
                    "category_id": cat_id,
                    "category_name": cat_name,
                    "amount": Decimal("0.00"),
                }
            category_spending_map[cat_id]["amount"] += amt

    net_balance = total_income - total_expenses
    savings_rate = 0.0
    if total_income > Decimal("0.00"):
        savings_rate = float(round((net_balance / total_income) * Decimal("100.0"), 2))

    monthly_savings = monthly_income - monthly_expenses
    monthly_savings_rate = 0.0
    if monthly_income > Decimal("0.00"):
        monthly_savings_rate = float(
            round((monthly_savings / monthly_income) * Decimal("100.0"), 2)
        )

    total_cashflow = total_income + total_expenses
    inflow_share_percentage = 0.0
    outflow_share_percentage = 0.0
    if total_cashflow > Decimal("0.00"):
        inflow_share_percentage = float(
            round((total_income / total_cashflow) * Decimal("100.0"), 1)
        )
        outflow_share_percentage = float(
            round((total_expenses / total_cashflow) * Decimal("100.0"), 1)
        )

    retained_income = max(net_balance, Decimal("0.00"))
    retained_percentage = 0.0
    if total_income > Decimal("0.00"):
        raw_retained = ((total_income - total_expenses) / total_income) * Decimal("100.0")
        retained_percentage = float(round(max(raw_retained, Decimal("0.0")), 1))

    if total_income > Decimal("0.00"):
        burn_rate_percentage = float(
            round((total_expenses / total_income) * Decimal("100.0"), 1)
        )
    elif total_expenses > Decimal("0.00"):
        burn_rate_percentage = 100.0
    else:
        burn_rate_percentage = 0.0

    cap_utilized_percentage = burn_rate_percentage
    cap_bar_width_percentage = float(min(max(burn_rate_percentage, 0.0), 100.0))

    if total_income > Decimal("0.00"):
        cashflow_ratio_percentage = float(
            round((net_balance / total_income) * Decimal("100.0"), 1)
        )
    elif total_expenses > Decimal("0.00"):
        cashflow_ratio_percentage = -100.0
    else:
        cashflow_ratio_percentage = 0.0

    if net_balance > Decimal("0.00"):
        balance_status = "Surplus"
    elif net_balance < Decimal("0.00"):
        balance_status = "Deficit"
    else:
        balance_status = "Balanced"

    clamped_savings_rate = float(min(max(savings_rate, 0.0), 100.0))
    rounded_savings_rate = int(round(clamped_savings_rate))
    gauge_circumference = 283.0
    gauge_offset = round(
        gauge_circumference - (clamped_savings_rate / 100.0) * gauge_circumference, 2
    )
    doughnut_circumference = 389.5

    if savings_rate >= 50.0:
        benchmark_tier = "Top 1% Savers"
    elif savings_rate >= 20.0:
        benchmark_tier = "Healthy Saver"
    elif savings_rate > 0.0:
        benchmark_tier = "Building Reserve"
    elif net_balance < Decimal("0.00"):
        benchmark_tier = "Deficit"
    else:
        benchmark_tier = "0% Baseline"

    has_activity = bool(total_income > Decimal("0.00") or total_expenses > Decimal("0.00"))
    trend_footnote = (
        "Peak net positive month recorded in current fiscal cycle"
        if has_activity
        else "No monthly cashflow recorded in current fiscal cycle"
    )
    current_month_short = now.strftime("%b %Y")
    current_month_long = now.strftime("%B")

    raw_categories = list(category_spending_map.values())
    raw_categories.sort(key=lambda x: x["amount"], reverse=True)

    spending_categories: List[SpendingByCategory] = []
    cumulative_stroke = 0.0
    for cat_data in raw_categories:
        percentage = 0.0
        if total_expenses > Decimal("0.00"):
            percentage = float(
                round((cat_data["amount"] / total_expenses) * Decimal("100.0"), 2)
            )
        if total_income > Decimal("0.00"):
            income_share_pct = float(
                round((cat_data["amount"] / total_income) * Decimal("100.0"), 1)
            )
            income_share_label = f"{income_share_pct:.1f}% of income"
        else:
            income_share_pct = float(round(percentage, 1))
            income_share_label = f"{income_share_pct:.1f}% of spend"

        bar_width_percentage = float(min(max(percentage, 0.0), 100.0))
        seg_len = round((percentage / 100.0) * doughnut_circumference, 2)
        dash_offset = round(-cumulative_stroke, 2)
        cumulative_stroke += seg_len

        spending_categories.append(
            SpendingByCategory(
                category_id=cat_data["category_id"],
                category_name=cat_data["category_name"],
                amount=cat_data["amount"],
                percentage=percentage,
                income_share_percentage=income_share_pct,
                income_share_label=income_share_label,
                bar_width_percentage=bar_width_percentage,
                doughnut_segment_length=seg_len,
                doughnut_dash_offset=dash_offset,
            )
        )

    top_spending_categories = spending_categories[:5]

    recent_txs_query = (
        db.query(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.book))
        .filter(Transaction.user_id == user_id)
    )
    if search and search.strip():
        term = f"%{search.strip()}%"
        recent_txs_query = recent_txs_query.outerjoin(Transaction.category).filter(
            or_(
                Transaction.description.ilike(term),
                Category.name.ilike(term),
                Transaction.type.ilike(term),
                cast(Transaction.amount, String).ilike(term),
            )
        )
    recent_txs = (
        recent_txs_query.order_by(
            Transaction.transaction_date.desc(), Transaction.id.desc()
        )
        .limit(5)
        .all()
    )

    recent_transactions = [_format_transaction_response(tx) for tx in recent_txs]

    return DashboardResponse(
        total_income=total_income,
        total_expenses=total_expenses,
        net_balance=net_balance,
        savings_rate=savings_rate,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        monthly_savings=monthly_savings,
        monthly_savings_rate=monthly_savings_rate,
        total_cashflow=total_cashflow,
        inflow_share_percentage=inflow_share_percentage,
        outflow_share_percentage=outflow_share_percentage,
        retained_income=retained_income,
        retained_percentage=retained_percentage,
        burn_rate_percentage=burn_rate_percentage,
        cap_utilized_percentage=cap_utilized_percentage,
        cap_bar_width_percentage=cap_bar_width_percentage,
        cashflow_ratio_percentage=cashflow_ratio_percentage,
        balance_status=balance_status,
        clamped_savings_rate=clamped_savings_rate,
        rounded_savings_rate=rounded_savings_rate,
        gauge_circumference=gauge_circumference,
        gauge_offset=gauge_offset,
        doughnut_circumference=doughnut_circumference,
        benchmark_tier=benchmark_tier,
        trend_footnote=trend_footnote,
        has_activity=has_activity,
        current_month_short=current_month_short,
        current_month_long=current_month_long,
        spending_by_category=spending_categories,
        top_spending_categories=top_spending_categories,
        recent_transactions=recent_transactions,
    )

def get_monthly_trends(
    db: Session,
    user_id: int,
    months_count: int = 6,
) -> MonthlyReportResponse:
    now = datetime.now(timezone.utc)
    raw_months = []

    total_income_sum = Decimal("0.00")
    total_expenses_sum = Decimal("0.00")
    max_observed = Decimal("70000.00")

    for i in range(months_count - 1, -1, -1):
        month_idx = now.month - i
        year = now.year
        while month_idx <= 0:
            month_idx += 12
            year -= 1

        start_date = datetime(year, month_idx, 1, tzinfo=timezone.utc)
        if month_idx == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(microseconds=1)
        else:
            end_date = datetime(year, month_idx + 1, 1, tzinfo=timezone.utc) - timedelta(microseconds=1)

        txs = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date,
            )
            .all()
        )

        income = Decimal("0.00")
        expenses = Decimal("0.00")
        for tx in txs:
            amt = Decimal(str(tx.amount))
            if tx.type == "income":
                income += amt
            elif tx.type == "expense":
                expenses += amt

        net_savings = income - expenses
        savings_rate = 0.0
        if income > Decimal("0.00"):
            savings_rate = float(round((net_savings / income) * Decimal("100.0"), 2))

        month_str = f"{year}-{month_idx:02d}"
        month_name = start_date.strftime("%b %Y")

        if income > max_observed:
            max_observed = income
        if expenses > max_observed:
            max_observed = expenses

        raw_months.append(
            {
                "month": month_str,
                "month_name": month_name,
                "income": income,
                "expenses": expenses,
                "net_savings": net_savings,
                "savings_rate": savings_rate,
            }
        )
        total_income_sum += income
        total_expenses_sum += expenses

    max_val_float = float(max_observed) if max_observed > Decimal("0.00") else 70000.0
    months_data: List[MonthlyTrendItem] = []
    for item in raw_months:
        inc_f = float(item["income"])
        exp_f = float(item["expenses"])
        inc_bar = min(max((inc_f / max_val_float) * 100.0, 5.0), 95.0) if inc_f > 0 else 0.0
        exp_bar = min(max((exp_f / max_val_float) * 100.0, 4.0), 95.0) if exp_f > 0 else 0.0
        months_data.append(
            MonthlyTrendItem(
                month=item["month"],
                month_name=item["month_name"],
                income=item["income"],
                expenses=item["expenses"],
                net_savings=item["net_savings"],
                savings_rate=item["savings_rate"],
                income_bar_height=round(inc_bar, 2),
                expense_bar_height=round(exp_bar, 2),
            )
        )

    y_axis_steps = [
        int(round((max_val_float * (step / 7.0)) / 1000.0) * 1000)
        for step in range(7, -1, -1)
    ]

    summary_net = total_income_sum - total_expenses_sum
    avg_savings_rate = 0.0
    if total_income_sum > Decimal("0.00"):
        avg_savings_rate = float(
            round((summary_net / total_income_sum) * Decimal("100.0"), 2)
        )

    return MonthlyReportResponse(
        months=months_data,
        summary_income=total_income_sum,
        summary_expenses=total_expenses_sum,
        summary_net=summary_net,
        average_savings_rate=avg_savings_rate,
        max_trend_value=max_observed,
        y_axis_steps=y_axis_steps,
    )

def get_category_breakdown(
    db: Session,
    user_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category_type: str = "expense",
) -> CategoryReportResponse:
    query = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == category_type,
        )
    )
    if start_date and end_date and start_date > end_date:
        start_date, end_date = end_date, start_date

    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        query = query.filter(Transaction.transaction_date <= end_date)

    txs = query.all()

    breakdown_map = {}
    total_amount = Decimal("0.00")

    for tx in txs:
        amt = Decimal(str(tx.amount))
        total_amount += amt
        cat_id = tx.category_id
        cat_name = tx.category.name if tx.category else "Uncategorized"
        if cat_id not in breakdown_map:
            breakdown_map[cat_id] = {
                "category_id": cat_id,
                "category_name": cat_name,
                "type": tx.type,
                "amount": Decimal("0.00"),
                "count": 0,
            }
        breakdown_map[cat_id]["amount"] += amt
        breakdown_map[cat_id]["count"] += 1

    items: List[CategoryReportItem] = []
    for cat in breakdown_map.values():
        percentage = 0.0
        if total_amount > Decimal("0.00"):
            percentage = float(
                round((cat["amount"] / total_amount) * Decimal("100.0"), 2)
            )
        items.append(
            CategoryReportItem(
                category_id=cat["category_id"],
                category_name=cat["category_name"],
                type=cat["type"],
                amount=cat["amount"],
                transaction_count=cat["count"],
                percentage=percentage,
            )
        )

    items.sort(key=lambda x: x.amount, reverse=True)

    return CategoryReportResponse(
        categories=items,
        total_amount=total_amount,
    )
