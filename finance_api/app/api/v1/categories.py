from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryType,
    CategoryUpdate,
)
from app.services.category import (
    create_category,
    delete_category,
    get_categories,
    get_category_by_id,
    update_category,
)

router = APIRouter()

@router.get("", response_model=List[CategoryResponse])
def list_categories(
    type: Optional[CategoryType] = Query(None, description="Filter categories by type (income or expense)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_categories(db, user_id=current_user.id, category_type=type)

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_new_category(
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_category(
        db,
        user_id=current_user.id,
        category_in=category_in,
        is_admin=current_user.is_admin,
    )

@router.patch("/{category_id}", response_model=CategoryResponse)
def update_existing_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = get_category_by_id(db, category_id=category_id, user_id=current_user.id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )
    if category.is_system:
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Default system categories cannot be modified.",
            )
    elif category.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this category.",
        )
    return update_category(db, category=category, category_in=category_in)

@router.delete("/{category_id}", response_model=MessageResponse)
def delete_existing_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = get_category_by_id(db, category_id=category_id, user_id=current_user.id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )
    if category.is_system:
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Default system categories cannot be deleted.",
            )
    elif category.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this category.",
        )
    deleted = delete_category(db, category=category)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete this category because it is referenced by existing transactions.",
        )
    return MessageResponse(message="Category successfully deleted.")
