from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin_user, get_db
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    AdminPlatformStats,
    AdminUserResponse,
    AdminUserUpdate,
)

router = APIRouter()

@router.get("/overview", response_model=AdminPlatformStats)
def get_admin_overview(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    total_users = len(users)
    active_users = sum(1 for u in users if u.is_active)
    inactive_users = total_users - active_users
    admin_users = sum(1 for u in users if u.is_admin)

    total_transactions = db.query(func.count(Transaction.id)).scalar() or 0
    total_income_volume = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(Transaction.type == "income")
        .scalar()
    ) or Decimal("0.00")
    total_expense_volume = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(Transaction.type == "expense")
        .scalar()
    ) or Decimal("0.00")

    system_categories_count = (
        db.query(func.count(Category.id)).filter(Category.is_system == True).scalar() or 0
    )
    custom_categories_count = (
        db.query(func.count(Category.id)).filter(Category.is_system == False).scalar() or 0
    )

    user_stats_rows = (
        db.query(
            Transaction.user_id,
            Transaction.type,
            func.count(Transaction.id).label("cnt"),
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total"),
        )
        .group_by(Transaction.user_id, Transaction.type)
        .all()
    )

    stats_by_user = {}
    for row in user_stats_rows:
        uid = row.user_id
        if uid not in stats_by_user:
            stats_by_user[uid] = {
                "tx_count": 0,
                "income": Decimal("0.00"),
                "expenses": Decimal("0.00"),
            }
        stats_by_user[uid]["tx_count"] += int(row.cnt)
        if row.type == "income":
            stats_by_user[uid]["income"] = Decimal(str(row.total)).quantize(Decimal("0.01"))
        else:
            stats_by_user[uid]["expenses"] = Decimal(str(row.total)).quantize(Decimal("0.01"))

    user_list = []
    for u in users:
        st = stats_by_user.get(
            u.id,
            {"tx_count": 0, "income": Decimal("0.00"), "expenses": Decimal("0.00")},
        )
        user_list.append(
            AdminUserResponse(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                is_active=u.is_active,
                is_admin=u.is_admin,
                created_at=u.created_at,
                updated_at=u.updated_at,
                transaction_count=st["tx_count"],
                total_income=st["income"],
                total_expenses=st["expenses"],
            )
        )

    return AdminPlatformStats(
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        admin_users=admin_users,
        total_transactions=total_transactions,
        total_income_volume=Decimal(str(total_income_volume)).quantize(Decimal("0.01")),
        total_expense_volume=Decimal(str(total_expense_volume)).quantize(Decimal("0.01")),
        system_categories_count=system_categories_count,
        custom_categories_count=custom_categories_count,
        users=user_list,
    )

@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def admin_update_user(
    user_id: int,
    update_in: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if target_user.id == current_admin.id:
        if update_in.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own admin account.",
            )
        if update_in.is_admin is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot revoke admin privileges from your own account.",
            )

    if update_in.full_name is not None:
        target_user.full_name = update_in.full_name.strip()
    if update_in.is_active is not None:
        target_user.is_active = update_in.is_active
    if update_in.is_admin is not None:
        target_user.is_admin = update_in.is_admin

    db.commit()
    db.refresh(target_user)

    tx_count = db.query(func.count(Transaction.id)).filter(Transaction.user_id == target_user.id).scalar() or 0
    inc = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(Transaction.user_id == target_user.id, Transaction.type == "income")
        .scalar()
    ) or Decimal("0.00")
    exp = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(Transaction.user_id == target_user.id, Transaction.type == "expense")
        .scalar()
    ) or Decimal("0.00")

    return AdminUserResponse(
        id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        is_active=target_user.is_active,
        is_admin=target_user.is_admin,
        created_at=target_user.created_at,
        updated_at=target_user.updated_at,
        transaction_count=tx_count,
        total_income=Decimal(str(inc)).quantize(Decimal("0.01")),
        total_expenses=Decimal(str(exp)).quantize(Decimal("0.01")),
    )

@router.delete("/users/{user_id}", response_model=MessageResponse)
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    if target_user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account.",
        )

    db.delete(target_user)
    db.commit()
    return MessageResponse(message=f"User {target_user.email} has been permanently deleted.")
