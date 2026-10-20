from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")
    verification_code: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None

class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_admin: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None

class AdminUserResponse(UserResponse):
    transaction_count: int = 0
    total_income: Decimal = Decimal("0.00")
    total_expenses: Decimal = Decimal("0.00")

class AdminPlatformStats(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    admin_users: int
    total_transactions: int
    total_income_volume: Decimal
    total_expense_volume: Decimal
    system_categories_count: int
    custom_categories_count: int
    users: List[AdminUserResponse]
