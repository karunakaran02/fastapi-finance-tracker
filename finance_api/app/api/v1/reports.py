from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.category import CategoryType
from app.schemas.report import (
    CategoryReportResponse,
    DashboardResponse,
    MonthlyReportResponse,
)
from app.services.report import (
    get_category_breakdown,
    get_dashboard_analytics,
    get_monthly_trends,
)

router = APIRouter()

@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    search: Optional[str] = Query(None, description="Optional search filter for recent transactions"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return get_dashboard_analytics(db, user_id=current_user.id, search=search)

@router.get("/monthly", response_model=MonthlyReportResponse)
def get_monthly_report(
    months: int = Query(6, ge=1, le=24, description="Number of past consecutive months to analyze"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return get_monthly_trends(db, user_id=current_user.id, months_count=months)

@router.get("/categories", response_model=CategoryReportResponse)
def get_category_report(
    start_date: Optional[datetime] = Query(None, description="Starting date filter (inclusive)"),
    end_date: Optional[datetime] = Query(None, description="Ending date filter (inclusive)"),
    type: CategoryType = Query("expense", description="Category type: expense or income"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return get_category_breakdown(
        db,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        category_type=type,
    )
