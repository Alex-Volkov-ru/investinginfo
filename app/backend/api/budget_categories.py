from __future__ import annotations

from typing import List, Optional, Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import BudgetCategory

router = APIRouter(prefix="/budget/categories", tags=["budget: categories"])

NameStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
KindStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=7)]  # income/expense

class CategoryOut(BaseModel):
    id: int
    kind: str
    name: str
    parent_id: Optional[int] = None
    is_active: bool
    monthly_limit: Optional[float] = None

class CategoryCreate(BaseModel):
    kind: KindStr
    name: NameStr
    parent_id: Optional[int] = None
    monthly_limit: Optional[float] = None

class CategoryUpdate(BaseModel):
    name: Optional[NameStr] = None
    monthly_limit: Optional[float] = None

@router.get("", response_model=List[CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    only_active: bool = Query(True),
):
    q = select(BudgetCategory).where(BudgetCategory.user_id == user.id)
    if only_active:
        q = q.where(BudgetCategory.is_active.is_(True))
    rows = db.execute(q.order_by(BudgetCategory.kind, BudgetCategory.name)).scalars().all()
    return [
        CategoryOut(
            id=r.id, kind=r.kind, name=r.name, parent_id=r.parent_id, is_active=r.is_active,
            monthly_limit=float(r.monthly_limit) if r.monthly_limit is not None else None
        ) for r in rows
    ]


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    exists = db.execute(
        select(BudgetCategory)
        .where(
            BudgetCategory.user_id == user.id,
            BudgetCategory.kind == payload.kind,
            BudgetCategory.name == payload.name,
            BudgetCategory.is_active == True,  # Проверяем только активные категории
        )
        .limit(1)
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="category already exists")

    cat = BudgetCategory(
        user_id=user.id,
        kind=payload.kind,
        name=payload.name,
        parent_id=payload.parent_id,
        is_active=True,
        monthly_limit=payload.monthly_limit,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryOut(
        id=cat.id, kind=cat.kind, name=cat.name, parent_id=cat.parent_id, is_active=cat.is_active,
        monthly_limit=float(cat.monthly_limit) if cat.monthly_limit is not None else None
    )


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = db.get(BudgetCategory, category_id)
    if not cat or cat.user_id != user.id:
        raise HTTPException(status_code=404, detail="category not found")

    if payload.name is not None:
        cat.name = payload.name
    if payload.monthly_limit is not None:
        cat.monthly_limit = payload.monthly_limit

    db.commit()
    db.refresh(cat)
    return CategoryOut(
        id=cat.id, kind=cat.kind, name=cat.name, parent_id=cat.parent_id, is_active=cat.is_active,
        monthly_limit=float(cat.monthly_limit) if cat.monthly_limit is not None else None
    )


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = db.get(BudgetCategory, category_id)
    if not cat or cat.user_id != user.id:
        raise HTTPException(status_code=404, detail="category not found")

    cat.is_active = False
    db.commit()
    return None
