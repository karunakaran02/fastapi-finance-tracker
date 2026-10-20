from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

RecurringType = Literal["expense", "income"]
RecurringFrequency = Literal["weekly", "biweekly", "monthly", "yearly"]
RecurringStatus = Literal["active", "paused", "cancelled"]

class RecurringBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    type: RecurringType = "expense"
    frequency: RecurringFrequency = "monthly"
    next_due_date: datetime
    category_id: Optional[int] = None
    book_id: Optional[int] = None
    auto_log: bool = False
    notes: Optional[str] = Field(None, max_length=500)

class RecurringCreate(RecurringBase):
    pass

class RecurringUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    type: Optional[RecurringType] = None
    frequency: Optional[RecurringFrequency] = None
    next_due_date: Optional[datetime] = None
    category_id: Optional[int] = None
    book_id: Optional[int] = None
    status: Optional[RecurringStatus] = None
    auto_log: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=500)

class RecurringResponse(BaseModel):
    id: int
    user_id: int
    book_id: Optional[int] = None
    book_title: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    name: str
    type: RecurringType
    amount: Decimal
    frequency: RecurringFrequency
    next_due_date: datetime
    status: RecurringStatus
    auto_log: bool
    notes: Optional[str] = None
    days_until_due: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class DailyForecastPoint(BaseModel):
    date: str
    day_name: str
    projected_balance: Decimal
    income_delta: Decimal
    expense_delta: Decimal
    events: List[str]

class UpcomingMilestone(BaseModel):
    id: int
    name: str
    amount: Decimal
    type: RecurringType
    due_date: datetime
    days_until_due: int
    frequency: RecurringFrequency
    category_name: Optional[str] = None
    book_title: Optional[str] = None
    status: RecurringStatus

class CashRunwayForecast(BaseModel):
    days_forecasted: int
    current_liquid_balance: Decimal
    projected_end_balance: Decimal
    monthly_recurring_burn: Decimal
    monthly_recurring_income: Decimal
    net_monthly_recurring: Decimal
    runway_days: Optional[int] = None
    runway_status: Literal["critical", "moderate", "healthy", "infinite_growth"]
    upcoming_7_days_count: int
    upcoming_7_days_total: Decimal
    upcoming_30_days_count: int
    upcoming_30_days_total: Decimal
    daily_timeline: List[DailyForecastPoint]
    upcoming_milestones: List[UpcomingMilestone]

class RecurringSuggestion(BaseModel):
    name: str
    detected_amount: Decimal
    frequency: RecurringFrequency
    estimated_monthly: Decimal
    occurrences_count: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    sample_dates: List[str]

