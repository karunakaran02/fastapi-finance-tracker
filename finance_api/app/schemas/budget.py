from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

BudgetType = Literal["expense", "income"]
BudgetPeriod = Literal["monthly", "per_transaction"]
BudgetStatus = Literal["safe", "warning", "exceeded"]

class BudgetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Name or label for this threshold")
    type: BudgetType = Field("expense", description="'expense' limit or 'income' goal")
    category_id: Optional[int] = Field(None, description="Optional category ID; if null, tracks global cashflow")
    threshold_amount: Decimal = Field(..., gt=0, decimal_places=2, description="Monetary threshold amount")
    period: BudgetPeriod = Field("monthly", description="'monthly' rolling cycle or 'per_transaction'")
    alert_email: Optional[EmailStr] = Field(None, description="Custom recipient email; defaults to account email if omitted")
    is_active: bool = Field(True, description="Whether alert evaluation is enabled")

class BudgetCreate(BudgetBase):
    pass

class BudgetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category_id: Optional[int] = None
    threshold_amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    period: Optional[BudgetPeriod] = None
    alert_email: Optional[EmailStr] = None
    is_active: Optional[bool] = None

class BudgetResponse(BudgetBase):
    id: int
    user_id: int
    category_name: Optional[str] = None
    last_triggered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    current_amount: Decimal = Decimal("0.00")
    percentage_used: float = 0.0
    remaining_amount: Decimal = Decimal("0.00")
    is_exceeded: bool = False
    status: BudgetStatus = "safe"
    notification_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class AlertNotificationResponse(BaseModel):
    id: int
    user_id: int
    budget_id: int
    budget_name: Optional[str] = None
    transaction_id: Optional[int] = None
    recipient_email: str
    subject: str
    message: str
    threshold_amount: Decimal
    current_amount: Decimal
    exceeded_by: Decimal
    sent_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BudgetOverviewResponse(BaseModel):
    total_budgets: int = 0
    active_budgets: int = 0
    exceeded_budgets: int = 0
    warning_budgets: int = 0
    total_budgeted_expense: Decimal = Decimal("0.00")
    total_spent_in_budgeted: Decimal = Decimal("0.00")
    total_notifications_sent: int = 0
    smtp_configured: bool = False
    budgets: List[BudgetResponse] = []
    recent_notifications: List[AlertNotificationResponse] = []
