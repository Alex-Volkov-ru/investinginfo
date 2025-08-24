from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import BudgetTransaction, BudgetAccount, BudgetCategory

router = APIRouter(prefix="/budget/transactions", tags=["budget"])


class TxOut(BaseModel):
    id: int
    account_id: int
    category_id: Optional[int] = None
    type: str
    amount: Decimal
    currency: str
    occurred_at: datetime
    description: Optional[str] = None
    contra_account_id: Optional[int] = None

    class Config:
        from_attributes = True


class TxCreateIn(BaseModel):
    account_id: int
    category_id: Optional[int] = None
    type: str = Field(pattern="^(income|expense|transfer)$")
    amount: Decimal = Field(ge=0)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    occurred_at: datetime
    description: Optional[str] = None
    contra_account_id: Optional[int] = None

    @field_validator("description")
    @classmethod
    def strip_desc(cls, v):
        return v.strip() if v else v


@router.get("", response_model=List[TxOut])
def list_transactions(
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    type: Optional[str] = Query(default=None, pattern="^(income|expense|transfer)$"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(200, ge=1, le=2000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(BudgetTransaction).filter(BudgetTransaction.user_id == user.id)
    if account_id:
        q = q.filter(BudgetTransaction.account_id == account_id)
    if category_id:
        q = q.filter(BudgetTransaction.category_id == category_id)
    if type:
        q = q.filter(BudgetTransaction.type == type)
    if date_from:
        q = q.filter(BudgetTransaction.occurred_at >= date_from)
    if date_to:
        q = q.filter(BudgetTransaction.occurred_at < date_to)

    return q.order_by(BudgetTransaction.occurred_at.desc(), BudgetTransaction.id.desc()).limit(limit).all()


@router.post("", response_model=TxOut)
def create_transaction(
    payload: TxCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # проверим счёт
    acc = db.query(BudgetAccount).filter(
        BudgetAccount.id == payload.account_id,
        BudgetAccount.user_id == user.id
    ).first()
    if not acc:
        raise HTTPException(400, "account_id не найден/чужой")

    # проверим категорию (если задана)
    if payload.category_id is not None:
        cat = db.query(BudgetCategory).filter(
            BudgetCategory.id == payload.category_id,
            BudgetCategory.user_id == user.id
        ).first()
        if not cat:
            raise HTTPException(400, "category_id не найден/чужой")
        # тип операции должен совпадать с типом категории
        if payload.type not in ("income", "expense"):
            raise HTTPException(400, "category_id допустим только для income/expense")
        if cat.kind != payload.type:
            raise HTTPException(400, "Тип категории не совпадает с типом операции")

    # transfer — проверим целевой счёт
    if payload.type == "transfer":
        if not payload.contra_account_id:
            raise HTTPException(400, "Для transfer нужен contra_account_id")
        if payload.contra_account_id == payload.account_id:
            raise HTTPException(400, "contra_account_id не может совпадать с account_id")
        acc2 = db.query(BudgetAccount).filter(
            BudgetAccount.id == payload.contra_account_id,
            BudgetAccount.user_id == user.id
        ).first()
        if not acc2:
            raise HTTPException(400, "contra_account_id не найден/чужой")
        if acc.currency != acc2.currency or acc.currency.upper() != payload.currency.upper():
            # упрощение: пока запрещаем кросс-валютные переводы
            raise HTTPException(400, "Валюты счетов и операции должны совпадать")

    tx = BudgetTransaction(
        user_id=user.id,
        account_id=payload.account_id,
        category_id=payload.category_id,
        type=payload.type,
        amount=payload.amount,
        currency=payload.currency.upper(),
        occurred_at=payload.occurred_at,
        description=payload.description,
        contra_account_id=payload.contra_account_id,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}")
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = db.query(BudgetTransaction).filter(
        and_(BudgetTransaction.id == tx_id, BudgetTransaction.user_id == user.id)
    ).first()
    if not tx:
        raise HTTPException(404, "Операция не найдена")
    db.delete(tx)
    db.commit()
    return {"ok": True}
