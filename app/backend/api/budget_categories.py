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

class CategoryCreate(BaseModel):
    kind: KindStr   # "income" | "expense"
    name: NameStr
    parent_id: Optional[int] = None

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
            id=r.id, kind=r.kind, name=r.name, parent_id=r.parent_id, is_active=r.is_active
        ) for r in rows
    ]


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # не дублировать имя в рамках пользователя и kind
    exists = db.execute(
        select(BudgetCategory)
        .where(
            BudgetCategory.user_id == user.id,
            BudgetCategory.kind == payload.kind,
            BudgetCategory.name == payload.name,
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
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryOut(id=cat.id, kind=cat.kind, name=cat.name, parent_id=cat.parent_id, is_active=cat.is_active)


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = db.get(BudgetCategory, category_id)
    if not cat or cat.user_id != user.id:
        raise HTTPException(status_code=404, detail="category not found")

    # мягко — просто деактивируем, чтобы не ломать существующие транзакции
    cat.is_active = False
    db.commit()
    return None
