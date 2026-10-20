from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import UserPasswordChange, UserResponse, UserUpdate
from app.services.email_validator import validate_deliverable_email
from app.services.user import get_user_by_email, update_user

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user)):

    return current_user

@router.patch("/me", response_model=UserResponse)
def update_user_profile(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if user_in.email and user_in.email != current_user.email:
        validated_email = validate_deliverable_email(user_in.email)
        user_in.email = validated_email
        existing = get_user_by_email(db, email=user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address is already in use by another account.",
            )
    updated = update_user(db, current_user, user_in)
    return updated

@router.post("/me/change-password", response_model=MessageResponse)
def change_password(
    password_data: UserPasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    current_user.password_hash = get_password_hash(password_data.new_password)
    db.commit()
    return MessageResponse(message="Password successfully updated.")
