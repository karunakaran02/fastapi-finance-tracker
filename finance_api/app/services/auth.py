from typing import Optional
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.models.user import User
from app.schemas.auth import Token
from app.services.user import get_user, get_user_by_email

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email=email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def create_user_tokens(user_id: int) -> Token:
    access_token = create_access_token(subject=user_id)
    refresh_token = create_refresh_token(subject=user_id)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )

def refresh_tokens(db: Session, refresh_token_str: str) -> Optional[Token]:
    try:
        payload = decode_refresh_token(refresh_token_str)
        user_id_str = payload.get("sub")
        token_type = payload.get("type")
        if not user_id_str or token_type != "refresh":
            return None
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        return None

    user = get_user(db, user_id=user_id)
    if not user or not user.is_active:
        return None

    return create_user_tokens(user.id)
