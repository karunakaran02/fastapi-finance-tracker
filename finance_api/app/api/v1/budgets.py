from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.models.budget import AlertNotification, Budget
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.budget import (
    AlertNotificationResponse,
    BudgetCreate,
    BudgetOverviewResponse,
    BudgetResponse,
    BudgetUpdate,
)
from app.services.budget import (
    create_budget,
    delete_budget,
    evaluate_and_trigger_alerts_background,
    get_budget_overview,
    get_budgets_with_analytics,
    get_single_budget_with_analytics,
    trigger_test_alert_background,
    update_budget,
)

router = APIRouter()

@router.get("/overview", response_model=BudgetOverviewResponse)
def get_user_budget_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_budget_overview(db, user_id=current_user.id)

@router.get("", response_model=List[BudgetResponse])
def list_user_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return get_budgets_with_analytics(db, user_id=current_user.id)

@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_new_budget(
    budget_in: BudgetCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:
        budget = create_budget(db, user_id=current_user.id, budget_in=budget_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    background_tasks.add_task(evaluate_and_trigger_alerts_background, current_user.id)
    return get_single_budget_with_analytics(db, budget=budget)

@router.patch("/{budget_id}", response_model=BudgetResponse)
def update_user_budget(
    budget_id: int,
    budget_in: BudgetUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Budget with ID {budget_id} not found.",
        )

    try:
        updated = update_budget(db, budget=budget, budget_in=budget_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    background_tasks.add_task(evaluate_and_trigger_alerts_background, current_user.id)
    return get_single_budget_with_analytics(db, budget=updated)

@router.delete("/{budget_id}", response_model=MessageResponse)
def delete_user_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Budget with ID {budget_id} not found.",
        )

    delete_budget(db, budget=budget)
    return MessageResponse(message=f"Budget '{budget.name}' deleted successfully.")

@router.post("/{budget_id}/test-alert", response_model=MessageResponse)
def test_budget_alert_email(
    budget_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Budget with ID {budget_id} not found.",
        )

    target_email = budget.alert_email or current_user.email
    background_tasks.add_task(trigger_test_alert_background, current_user.id, budget.id)

    if settings.SMTP_HOST:
        msg = f"Test alert email queued for '{target_email}' via SMTP ({settings.SMTP_HOST}). Check your inbox shortly!"
    else:
        msg = f"Test alert generated for '{target_email}' and recorded in your Audit Log (Mock Mode). Configure SMTP_HOST in .env to deliver to real inboxes."

    return MessageResponse(message=msg)

@router.get("/notifications", response_model=List[AlertNotificationResponse])
def list_alert_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    notifications = (
        db.query(AlertNotification)
        .options(joinedload(AlertNotification.budget))
        .filter(AlertNotification.user_id == current_user.id)
        .order_by(AlertNotification.sent_at.desc())
        .limit(50)
        .all()
    )
    return [
        AlertNotificationResponse(
            id=n.id,
            user_id=n.user_id,
            budget_id=n.budget_id,
            budget_name=n.budget.name if n.budget else "Budget",
            transaction_id=n.transaction_id,
            recipient_email=n.recipient_email,
            subject=n.subject,
            message=n.message,
            threshold_amount=n.threshold_amount,
            current_amount=n.current_amount,
            exceeded_by=n.exceeded_by,
            sent_at=n.sent_at,
        )
        for n in notifications
    ]
