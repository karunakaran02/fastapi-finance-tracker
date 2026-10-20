from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

CategoryType = Literal["income", "expense"]

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: CategoryType

class CategoryCreate(CategoryBase):
    is_system: Optional[bool] = False

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[CategoryType] = None

class CategoryResponse(CategoryBase):
    id: int
    user_id: Optional[int] = None
    is_system: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
