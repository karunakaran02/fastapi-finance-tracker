from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

StreamEntryType = Literal["IN", "OUT"]


class StreamBookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field("#3b82f6", max_length=20)
    icon: Optional[str] = Field("book", max_length=50)


class StreamBookCreate(StreamBookBase):
    pass


class StreamBookUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, max_length=20)
    icon: Optional[str] = Field(None, max_length=50)


class StreamBookResponse(StreamBookBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class StreamBookSummary(StreamBookResponse):
    total_income: Decimal = Decimal("0.00")
    total_expense: Decimal = Decimal("0.00")
    net_balance: Decimal = Decimal("0.00")
    entries_count: int = 0


class StreamEntryBase(BaseModel):
    type: StreamEntryType
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    remarks: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    entry_date: datetime


class StreamEntryCreate(StreamEntryBase):
    pass


class StreamEntryUpdate(BaseModel):
    type: Optional[StreamEntryType] = None
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    remarks: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    entry_date: Optional[datetime] = None


class StreamEntryResponse(StreamEntryBase):
    id: int
    book_id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    running_balance: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedStreamEntries(BaseModel):
    items: List[StreamEntryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    total_income: Decimal = Decimal("0.00")
    total_expense: Decimal = Decimal("0.00")
    net_balance: Decimal = Decimal("0.00")

