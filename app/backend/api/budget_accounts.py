from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import BudgetAccount

router = APIRouter(prefix="/budget/accounts", tags=["budget"])


class AccountOut(BaseModel):
    id: int
    title: str
    currency: str
    created_at: datetime
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AccountCreateIn(BaseModel):
    title: str = Field(min_length=1)
    currency: str = Field(default="RUB", min_length=3, max_length=3)


class AccountPatchIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    archive: Optional[bool] = None  # True -> архивируем, False -> разархивируем


@router.get("", response_model=List[AccountOut])
def list_accounts(
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(BudgetAccount).filter(BudgetAccount.user_id == user.id)
    if not include_archived:
        q = q.filter(BudgetAccount.archived_at.is_(None))
    return q.order_by(BudgetAccount.created_at).all()


@router.post("", response_model=AccountOut)
def create_account(
    payload: AccountCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = BudgetAccount(
        user_id=user.id,
        title=payload.title.strip(),
        currency=payload.currency.upper(),
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.patch("/{account_id}", response_model=AccountOut)
def patch_account(
    account_id: int,
    payload: AccountPatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = db.query(BudgetAccount).filter(
        BudgetAccount.id == account_id, BudgetAccount.user_id == user.id
    ).first()
    if not acc:
        raise HTTPException(404, "Счёт не найден")

    if payload.title is not None:
        acc.title = payload.title.strip()
    if payload.currency is not None:
        acc.currency = payload.currency.upper()
    if payload.archive is True and acc.archived_at is None:
        acc.archived_at = datetime.utcnow()
    if payload.archive is False:
        acc.archived_at = None

    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = db.query(BudgetAccount).filter(
        BudgetAccount.id == account_id, BudgetAccount.user_id == user.id
    ).first()
    if not acc:
        raise HTTPException(404, "Счёт не найден")

    # мягкая защита: если есть транзакции — не удаляем
    tx_exists = db.execute(
        "select 1 from pf.budget_transactions where account_id = :aid limit 1",
        {"aid": account_id},
    ).first()
    if tx_exists:
        raise HTTPException(409, "Есть операции по счёту — удалите их или заархивируйте счёт")

    db.delete(acc)
    db.commit()
    return {"ok": True}
