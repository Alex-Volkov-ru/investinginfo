from __future__ import annotations

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import BudgetCategory, BudgetTransaction

router = APIRouter(prefix="/budget/categories", tags=["budget"])


class CategoryOut(BaseModel):
    id: int
    kind: str
    name: str
    parent_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True


class CategoryCreateIn(BaseModel):
    kind: str = Field(pattern="^(income|expense)$")
    name: str = Field(min_length=1)
    parent_id: Optional[int] = None


class CategoryPatchIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", response_model=List[CategoryOut])
def list_categories(
    kind: Optional[str] = Query(default=None, pattern="^(income|expense)$"),
    only_active: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(BudgetCategory).filter(BudgetCategory.user_id == user.id)
    if kind:
        q = q.filter(BudgetCategory.kind == kind)
    if only_active:
        q = q.filter(BudgetCategory.is_active.is_(True))
    return q.order_by(BudgetCategory.kind, BudgetCategory.name).all()


@router.post("", response_model=CategoryOut)
def create_category(
    payload: CategoryCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # уникальность внутри пользователя
    exists = db.query(BudgetCategory).filter(
        BudgetCategory.user_id == user.id,
        BudgetCategory.kind == payload.kind,
        BudgetCategory.name == payload.name.strip(),
    ).first()
    if exists:
        raise HTTPException(409, "Такая категория уже существует")

    parent_id = payload.parent_id
    if parent_id is not None:
        parent = db.query(BudgetCategory).filter(
            BudgetCategory.id == parent_id, BudgetCategory.user_id == user.id
        ).first()
        if not parent:
            raise HTTPException(400, "parent_id не найден/чужой")

    cat = BudgetCategory(
        user_id=user.id,
        kind=payload.kind,
        name=payload.name.strip(),
        parent_id=parent_id,
        is_active=True,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryOut)
def patch_category(
    category_id: int,
    payload: CategoryPatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = db.query(BudgetCategory).filter(
        BudgetCategory.id == category_id,
        BudgetCategory.user_id == user.id,
    ).first()
    if not cat:
        raise HTTPException(404, "Категория не найдена")

    if payload.name is not None:
        # проверка дубля
        dup = db.query(BudgetCategory).filter(
            BudgetCategory.user_id == user.id,
            BudgetCategory.kind == cat.kind,
            BudgetCategory.name == payload.name.strip(),
            BudgetCategory.id != category_id,
        ).first()
        if dup:
            raise HTTPException(409, "Категория с таким именем уже есть")
        cat.name = payload.name.strip()

    if payload.parent_id is not None:
        if payload.parent_id == category_id:
            raise HTTPException(400, "parent_id не может указывать на себя")
        parent = db.query(BudgetCategory).filter(
            BudgetCategory.id == payload.parent_id,
            BudgetCategory.user_id == user.id
        ).first()
        if not parent:
            raise HTTPException(400, "parent_id не найден/чужой")
        if parent.kind != cat.kind:
            raise HTTPException(400, "parent_id должен быть того же типа (income/expense)")
        cat.parent_id = payload.parent_id

    if payload.is_active is not None:
        cat.is_active = payload.is_active

    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = db.query(BudgetCategory).filter(
        BudgetCategory.id == category_id,
        BudgetCategory.user_id == user.id,
    ).first()
    if not cat:
        raise HTTPException(404, "Категория не найдена")

    # запретим удалять, если есть операции с ней
    used = db.query(BudgetTransaction).filter(
        and_(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.category_id == category_id,
        )
    ).first()
    if used:
        raise HTTPException(409, "Нельзя удалить: есть операции с этой категорией")

    db.delete(cat)
    db.commit()
    return {"ok": True}
