from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.recurring import (
    CashRunwayForecast,
    RecurringCreate,
    RecurringResponse,
    RecurringSuggestion,
    RecurringUpdate,
)
from app.services import recurring as recurring_service

router = APIRouter(prefix="/recurring", tags=["Recurring & Forecasting"])

@router.get("", response_model=List[RecurringResponse])
def get_recurring_items(
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, PAUSED, CANCELLED"),
    book_id: Optional[int] = Query(None, description="Filter by book ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.list_recurring(db, current_user.id, status=status, book_id=book_id)

@router.post("", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_item(
    payload: RecurringCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.create_recurring(db, current_user.id, payload)

@router.get("/forecast", response_model=CashRunwayForecast)
def get_cash_runway_forecast(
    days: int = Query(30, ge=7, le=365, description="Days to forecast"),
    book_id: Optional[int] = Query(None, description="Specific stream book to isolate"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.calculate_forecast(db, current_user.id, days=days, book_id=book_id)

@router.get("/suggestions", response_model=List[RecurringSuggestion])
def get_recurring_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.detect_suggestions(db, current_user.id)

@router.get("/{item_id}", response_model=RecurringResponse)
def get_recurring_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = recurring_service.get_recurring(db, current_user.id, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring item not found",
        )
    return item

@router.put("/{item_id}", response_model=RecurringResponse)
def update_recurring_item(
    item_id: int,
    payload: RecurringUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = recurring_service.update_recurring(db, current_user.id, item_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring item not found",
        )
    return updated

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = recurring_service.delete_recurring(db, current_user.id, item_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring item not found",
        )
    return None

