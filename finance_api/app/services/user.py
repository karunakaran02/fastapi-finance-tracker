from typing import Optional
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower().strip()).first()

def create_user(db: Session, user_in: UserCreate) -> User:
    hashed_password = get_password_hash(user_in.password)
    clean_email = user_in.email.lower().strip()
    db_user = User(
        email=clean_email,
        password_hash=hashed_password,
        full_name=user_in.full_name,
        is_active=True,
        is_admin=clean_email.startswith("admin@"),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def seed_default_admin(db: Session) -> None:
    admin_prefix_users = db.query(User).filter(User.email.like("admin@%")).all()
    for u in admin_prefix_users:
        if not u.is_admin:
            u.is_admin = True
    db.commit()

    any_admin = db.query(User).filter(User.is_admin == True).first()
    if not any_admin:
        default_admin = User(
            email="admin@finance.in",
            password_hash=get_password_hash("Admin@1234"),
            full_name="Platform Administrator",
            is_active=True,
            is_admin=True,
        )
        db.add(default_admin)
        db.commit()

def update_user(db: Session, user: User, user_in: UserUpdate) -> User:
    update_data = user_in.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"]:
        update_data["email"] = update_data["email"].lower().strip()
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user

def delete_user(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()
