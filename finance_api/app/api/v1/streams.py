from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.stream import (
    PaginatedStreamEntries,
    StreamBookCreate,
    StreamBookSummary,
    StreamBookUpdate,
    StreamEntryCreate,
    StreamEntryResponse,
    StreamEntryUpdate,
)
from app.services import stream as stream_service

router = APIRouter()

@router.get("/books", response_model=List[StreamBookSummary])
def get_stream_books(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return stream_service.list_user_books(db, current_user.id)

@router.post("/books", response_model=StreamBookSummary, status_code=status.HTTP_201_CREATED)
def create_stream_book(
    book_in: StreamBookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return stream_service.create_book(db, current_user.id, book_in)

@router.get("/books/{book_id}", response_model=StreamBookSummary)
def get_stream_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = stream_service.get_book_summary(db, book_id, current_user.id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stream book not found",
        )
    return book

@router.patch("/books/{book_id}", response_model=StreamBookSummary)
def update_stream_book(
    book_id: int,
    book_in: StreamBookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = stream_service.update_book(db, book_id, current_user.id, book_in)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stream book not found",
        )
    return book

@router.delete("/books/{book_id}", response_model=MessageResponse)
def delete_stream_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = stream_service.delete_book(db, book_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stream book not found",
        )
    return MessageResponse(message="Stream book deleted successfully")

@router.get("/books/{book_id}/entries", response_model=PaginatedStreamEntries)
def get_stream_entries(
    book_id: int,
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entries = stream_service.list_book_entries(
        db=db,
        book_id=book_id,
        user_id=current_user.id,
        search=search,
        type_filter=type,
        category_filter=category,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    if entries is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stream book not found",
        )
    return entries

@router.post(
    "/books/{book_id}/entries",
    response_model=StreamEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_stream_entry(
    book_id: int,
    entry_in: StreamEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = stream_service.create_entry(db, book_id, current_user.id, entry_in)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stream book not found",
        )
    return entry

@router.patch("/books/{book_id}/entries/{entry_id}", response_model=StreamEntryResponse)
def update_stream_entry(
    book_id: int,
    entry_id: int,
    entry_in: StreamEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = stream_service.update_entry(db, book_id, entry_id, current_user.id, entry_in)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stream entry not found",
        )
    return entry

@router.delete("/books/{book_id}/entries/{entry_id}", response_model=MessageResponse)
def delete_stream_entry(
    book_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = stream_service.delete_entry(db, book_id, entry_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stream entry not found",
        )
    return MessageResponse(message="Stream entry deleted successfully")

@router.get("/books/{book_id}/export")
def export_stream_book(
    book_id: int,
    format: str = Query("csv", description="Export format: pdf or csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fmt = format.strip().lower()
    if fmt == "pdf":
        pdf_bytes = stream_service.export_book_pdf(db, book_id, current_user.id)
        if not pdf_bytes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stream book not found",
            )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=stream_book_{book_id}_statement.pdf"
            },
        )
    csv_stream = stream_service.export_book_csv(db, book_id, current_user.id)
    if not csv_stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stream book not found",
        )
    return Response(
        content=csv_stream.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=stream_book_{book_id}_statement.csv"
        },
    )
