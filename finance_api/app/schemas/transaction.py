from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

TransactionType = Literal["income", "expense"]

class TransactionBase(BaseModel):
    category_id: int
    book_id: Optional[int] = None
    type: TransactionType
    amount: Decimal = Field(..., gt=0, decimal_places=2, description="Monetary amount, strictly positive decimal")
    description: Optional[str] = Field(None, max_length=500)
    transaction_date: datetime

class TransactionCreate(TransactionBase):
    book_id: Optional[int] = None

class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    book_id: Optional[int] = None
    type: Optional[TransactionType] = None
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    description: Optional[str] = Field(None, max_length=500)
    transaction_date: Optional[datetime] = None

class TransactionResponse(BaseModel):
    id: int
    user_id: int
    book_id: int
    book_title: Optional[str] = None
    book_color: Optional[str] = None
    book_icon: Optional[str] = None
    category_id: int
    category_name: Optional[str] = None
    type: TransactionType
    amount: Decimal
    description: Optional[str] = None
    transaction_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class PaginatedTransactions(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class FileImportSummary(BaseModel):
    filename: str
    file_type: str = "csv"
    imported_count: int
    skipped_count: int
    imported_income: Decimal = Decimal("0.00")
    imported_expense: Decimal = Decimal("0.00")
    errors: List[str] = []

class TransactionImportResponse(BaseModel):
    message: str = "Transactions imported successfully."
    files_processed: int
    total_files: int = 0
    imported_count: int
    total_imported: int = 0
    skipped_count: int
    total_skipped: int = 0
    imported_income_total: Decimal = Decimal("0.00")
    imported_income: Decimal = Decimal("0.00")
    imported_expense_total: Decimal = Decimal("0.00")
    imported_expenses: Decimal = Decimal("0.00")
    categories_created: List[str] = []
    file_summaries: List[FileImportSummary] = []
    files: List[FileImportSummary] = []
    errors: List[str] = []
