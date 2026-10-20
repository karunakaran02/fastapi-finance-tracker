from typing import List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.category import CategoryCreate, CategoryUpdate

DEFAULT_EXPENSE_CATEGORIES = [
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Entertainment",
    "Healthcare",
    "Education",
    "Travel",
    "Other",
]

DEFAULT_INCOME_CATEGORIES = [
    "Salary",
    "Freelance",
    "Business",
    "Investment",
    "Other",
]

def seed_default_categories(db: Session) -> None:
    for name in DEFAULT_EXPENSE_CATEGORIES:
        exists = (
            db.query(Category)
            .filter(Category.name == name, Category.type == "expense", Category.is_system == True)
            .first()
        )
        if not exists:
            db.add(Category(name=name, type="expense", is_system=True, user_id=None))

    for name in DEFAULT_INCOME_CATEGORIES:
        exists = (
            db.query(Category)
            .filter(Category.name == name, Category.type == "income", Category.is_system == True)
            .first()
        )
        if not exists:
            db.add(Category(name=name, type="income", is_system=True, user_id=None))

    db.commit()

def get_categories(
    db: Session,
    user_id: int,
    category_type: Optional[str] = None,
) -> List[Category]:
    query = db.query(Category).filter(
        or_(Category.is_system == True, Category.user_id == user_id)
    )
    if category_type:
        query = query.filter(Category.type == category_type)
    return query.order_by(Category.is_system.desc(), Category.name.asc()).all()

def get_category_by_id(
    db: Session,
    category_id: int,
    user_id: int,
) -> Optional[Category]:
    return (
        db.query(Category)
        .filter(
            Category.id == category_id,
            or_(Category.is_system == True, Category.user_id == user_id),
        )
        .first()
    )

def create_category(
    db: Session,
    user_id: int,
    category_in: CategoryCreate,
    is_admin: bool = False,
) -> Category:
    make_system = bool(is_admin and category_in.is_system)
    existing = (
        db.query(Category)
        .filter(
            Category.name.ilike(category_in.name.strip()),
            Category.type == category_in.type,
            or_(Category.is_system == True, Category.user_id == user_id),
        )
        .first()
    )
    if existing:
        return existing

    category = Category(
        name=category_in.name.strip(),
        type=category_in.type,
        user_id=None if make_system else user_id,
        is_system=make_system,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

def update_category(
    db: Session,
    category: Category,
    category_in: CategoryUpdate,
) -> Category:
    update_data = category_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()
    for key, value in update_data.items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category

def delete_category(db: Session, category: Category) -> bool:
    tx_count = db.query(Transaction).filter(Transaction.category_id == category.id).count()
    if tx_count > 0:
        return False
    db.delete(category)
    db.commit()
    return True
