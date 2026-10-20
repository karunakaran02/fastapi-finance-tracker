from decimal import Decimal
from typing import List
from pydantic import BaseModel
from app.schemas.transaction import TransactionResponse

class SpendingByCategory(BaseModel):
    category_id: int
    category_name: str
    amount: Decimal
    percentage: float
    income_share_percentage: float = 0.0
    income_share_label: str = "0.0% of spend"
    bar_width_percentage: float = 0.0
    doughnut_segment_length: float = 0.0
    doughnut_dash_offset: float = 0.0

class DashboardResponse(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net_balance: Decimal
    savings_rate: float
    monthly_income: Decimal
    monthly_expenses: Decimal
    monthly_savings: Decimal
    monthly_savings_rate: float
    total_cashflow: Decimal = Decimal("0.00")
    inflow_share_percentage: float = 0.0
    outflow_share_percentage: float = 0.0
    retained_income: Decimal = Decimal("0.00")
    retained_percentage: float = 0.0
    burn_rate_percentage: float = 0.0
    cap_utilized_percentage: float = 0.0
    cap_bar_width_percentage: float = 0.0
    cashflow_ratio_percentage: float = 0.0
    balance_status: str = "Balanced"
    clamped_savings_rate: float = 0.0
    rounded_savings_rate: int = 0
    gauge_circumference: float = 283.0
    gauge_offset: float = 283.0
    doughnut_circumference: float = 389.5
    benchmark_tier: str = "0% Baseline"
    trend_footnote: str = "No monthly cashflow recorded in current fiscal cycle"
    has_activity: bool = False
    current_month_short: str = ""
    current_month_long: str = ""
    spending_by_category: List[SpendingByCategory]
    top_spending_categories: List[SpendingByCategory]
    recent_transactions: List[TransactionResponse]

class MonthlyTrendItem(BaseModel):
    month: str
    month_name: str
    income: Decimal
    expenses: Decimal
    net_savings: Decimal
    savings_rate: float
    income_bar_height: float = 0.0
    expense_bar_height: float = 0.0

class CategoryReportItem(BaseModel):
    category_id: int
    category_name: str
    type: str
    amount: Decimal
    transaction_count: int
    percentage: float

class MonthlyReportResponse(BaseModel):
    months: List[MonthlyTrendItem]
    summary_income: Decimal
    summary_expenses: Decimal
    summary_net: Decimal
    average_savings_rate: float
    max_trend_value: Decimal = Decimal("70000.00")
    y_axis_steps: List[int] = []

class CategoryReportResponse(BaseModel):
    categories: List[CategoryReportItem]
    total_amount: Decimal
