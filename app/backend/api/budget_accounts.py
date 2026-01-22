from __future__ import annotations

from typing import List, Optional, Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.core.constants import (
    DEFAULT_CURRENCY,
    ERROR_ACCOUNT_NOT_FOUND,
    HTTP_404_NOT_FOUND,
)
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import BudgetAccount

router = APIRouter(prefix="/budget/accounts", tags=["budget: accounts"])

TitleStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
CurStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=3)]

class AccountOut(BaseModel):
    id: int
    title: str
    currency: str
    is_savings: bool
    created_at: Optional[str] = None

class AccountCreate(BaseModel):
    title: TitleStr
    currency: CurStr = DEFAULT_CURRENCY
    is_savings: bool = False

class AccountPatch(BaseModel):
    title: Optional[TitleStr] = None
    currency: Optional[CurStr] = None
    is_savings: Optional[bool] = None


@router.get("", response_model=List[AccountOut])
def list_accounts(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    q = select(BudgetAccount).where(BudgetAccount.user_id == user.id)
    rows = db.execute(q.order_by(BudgetAccount.id.asc())).scalars().all()
    return [
        AccountOut(
            id=r.id,
            title=r.title,
            currency=r.currency,
            is_savings=r.is_savings,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.post("", response_model=AccountOut, status_code=201)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = BudgetAccount(
        user_id=user.id,
        title=payload.title,
        currency=payload.currency,
        is_savings=payload.is_savings,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return AccountOut(
        id=acc.id,
        title=acc.title,
        currency=acc.currency,
        is_savings=acc.is_savings,
        created_at=acc.created_at.isoformat() if acc.created_at else None,
    )


@router.patch("/{account_id}", response_model=AccountOut)
def patch_account(
    account_id: int,
    payload: AccountPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = db.get(BudgetAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail=ERROR_ACCOUNT_NOT_FOUND)

    if payload.title is not None:
        acc.title = payload.title
    if payload.currency is not None:
        acc.currency = payload.currency
    if payload.is_savings is not None:
        acc.is_savings = payload.is_savings

    db.commit()
    db.refresh(acc)

    return AccountOut(
        id=acc.id,
        title=acc.title,
        currency=acc.currency,
        is_savings=acc.is_savings,
        created_at=acc.created_at.isoformat() if acc.created_at else None,
    )


@router.delete("/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = db.get(BudgetAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail=ERROR_ACCOUNT_NOT_FOUND)

    db.delete(acc)
    db.commit()
    return None
