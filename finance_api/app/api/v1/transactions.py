import math
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.transaction import (
    PaginatedTransactions,
    TransactionCreate,
    TransactionImportResponse,
    TransactionResponse,
    TransactionType,
    TransactionUpdate,
)
from app.services.budget import evaluate_and_trigger_alerts_background
from app.services.category import get_category_by_id
from app.services.transaction import (
    create_transaction,
    delete_all_user_transactions,
    delete_transaction,
    export_transactions_csv,
    get_import_template_csv,
    get_import_template_pdf,
    get_transaction,
    get_transactions,
    import_transactions_from_files,
    update_transaction,
)

router = APIRouter()

def _format_transaction(tx) -> TransactionResponse:
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

@router.get("", response_model=PaginatedTransactions)
def list_transactions(
    type: Optional[TransactionType] = Query(None, description="Filter by transaction type: income or expense"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    book_id: Optional[int] = Query(None, description="Filter by stream book ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by starting date (inclusive)"),
    end_date: Optional[datetime] = Query(None, description="Filter by ending date (inclusive)"),
    search: Optional[str] = Query(None, description="Case-insensitive search query in description"),
    sort: str = Query("date_desc", description="Sort order: date_desc, date_asc, amount_desc, amount_asc"),
    page: int = Query(1, ge=1, description="Page number starting from 1"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    items, total = get_transactions(
        db=db,
        user_id=current_user.id,
        transaction_type=type,
        category_id=category_id,
        book_id=book_id,
        start_date=start_date,
        end_date=end_date,
        search=search,
        sort=sort,
        page=page,
        page_size=page_size,
    )

    total_pages = math.ceil(total / page_size) if total > 0 else 0
    formatted_items = [_format_transaction(tx) for tx in items]

    return PaginatedTransactions(
        items=formatted_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_new_transaction(
    transaction_in: TransactionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    category = get_category_by_id(db, category_id=transaction_in.category_id, user_id=current_user.id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified category does not exist or is not accessible.",
        )
    if category.type != transaction_in.type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{category.name}' has type '{category.type}', which does not match transaction type '{transaction_in.type}'.",
        )

    tx = create_transaction(db, user_id=current_user.id, transaction_in=transaction_in)
    background_tasks.add_task(evaluate_and_trigger_alerts_background, current_user.id, [tx.id])
    return _format_transaction(tx)

@router.post("/import", response_model=TransactionImportResponse)
async def import_transactions(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="Single or multiple PDF / CSV / JSON transaction files"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least one PDF or CSV file to import.",
        )

    file_payloads = []
    for upload in files:
        content = await upload.read()
        file_payloads.append((upload.filename or "transactions.csv", content))

    result = import_transactions_from_files(
        db=db,
        user_id=current_user.id,
        file_payloads=file_payloads,
    )
    background_tasks.add_task(evaluate_and_trigger_alerts_background, current_user.id)
    return result

@router.get("/export")
def export_transactions(
    type: Optional[TransactionType] = Query(None, description="Filter by transaction type: income or expense"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    book_id: Optional[int] = Query(None, description="Filter by stream book ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by starting date (inclusive)"),
    end_date: Optional[datetime] = Query(None, description="Filter by ending date (inclusive)"),
    search: Optional[str] = Query(None, description="Case-insensitive search query in description"),
    sort: str = Query("date_desc", description="Sort order: date_desc, date_asc, amount_desc, amount_asc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv_data = export_transactions_csv(
        db=db,
        user_id=current_user.id,
        transaction_type=type,
        category_id=category_id,
        book_id=book_id,
        start_date=start_date,
        end_date=end_date,
        search=search,
        sort=sort,
    )
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="finance_intel_ledger.csv"'},
    )

@router.get("/import-template")
def download_import_template(
    format: str = Query("csv", description="Template format: csv or pdf"),
    current_user: User = Depends(get_current_user),
):
    if format.strip().lower() == "pdf":
        pdf_bytes = get_import_template_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="transactions_import_template.pdf"'},
        )
    template_csv = get_import_template_csv()
    return Response(
        content=template_csv,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="transactions_import_template.csv"'},
    )

@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_single_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    tx = get_transaction(db, transaction_id=transaction_id, user_id=current_user.id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )
    return _format_transaction(tx)

@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_existing_transaction(
    transaction_id: int,
    transaction_in: TransactionUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    tx = get_transaction(db, transaction_id=transaction_id, user_id=current_user.id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )

    target_category_id = transaction_in.category_id if transaction_in.category_id is not None else tx.category_id
    target_type = transaction_in.type if transaction_in.type is not None else tx.type

    category = get_category_by_id(db, category_id=target_category_id, user_id=current_user.id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target category does not exist or is not accessible.",
        )
    if category.type != target_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{category.name}' has type '{category.type}', which does not match transaction type '{target_type}'.",
        )

    updated_tx = update_transaction(db, transaction=tx, transaction_in=transaction_in)
    background_tasks.add_task(evaluate_and_trigger_alerts_background, current_user.id, [updated_tx.id])
    return _format_transaction(updated_tx)

@router.delete("/clear-all", response_model=MessageResponse)
def clear_all_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted_count = delete_all_user_transactions(db, user_id=current_user.id)
    return MessageResponse(
        message=f"Successfully cleared all {deleted_count} transaction(s)."
    )

@router.delete("/{transaction_id}", response_model=MessageResponse)
def delete_existing_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    tx = get_transaction(db, transaction_id=transaction_id, user_id=current_user.id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )
    delete_transaction(db, transaction=tx)
    return MessageResponse(message="Transaction successfully deleted.")
