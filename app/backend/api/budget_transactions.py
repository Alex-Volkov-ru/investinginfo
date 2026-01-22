from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.core.security import encrypt_amount, decrypt_amount
from app.backend.core.constants import (
    DEFAULT_CURRENCY,
    MONTH_END_CALC_DAY,
    MONTH_END_CALC_OFFSET,
    TRANSACTION_TYPE_INCOME,
    TRANSACTION_TYPE_EXPENSE,
    TRANSACTION_TYPE_TRANSFER,
    ERROR_INVALID_TRANSFER_PARAMS,
    ERROR_ACCOUNTS_UNAVAILABLE,
    ERROR_ACCOUNT_INACTIVE,
    ERROR_CATEGORY_REQUIRED_TEMPLATE,
    ERROR_UNKNOWN_TRANSACTION_TYPE,
    ERROR_TRANSACTION_NOT_FOUND,
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
)
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import (
    BudgetTransaction,
    BudgetAccount,
    BudgetCategory,
)

router = APIRouter(prefix="/budget/transactions", tags=["budget: transactions"])


# ===== Schemas =====

TransactionType = Literal[TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_EXPENSE, TRANSACTION_TYPE_TRANSFER]


class TransactionCreate(BaseModel):
    type: TransactionType
    account_id: int
    contra_account_id: Optional[int] = None
    category_id: Optional[int] = None

    amount: Decimal = Field(..., gt=0)
    currency: str = DEFAULT_CURRENCY
    occurred_at: Optional[str] = None
    description: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def _cur(cls, v: str) -> str:
        return v.upper()


class CategoryOut(BaseModel):
    id: int
    name: str


class TransactionOut(BaseModel):
    id: int
    type: TransactionType
    account_id: int
    contra_account_id: Optional[int]
    category_id: Optional[int] = None
    category: Optional[CategoryOut] = None
    amount: float
    currency: str
    occurred_at: str
    description: Optional[str]


# ===== Helpers =====

def _dates(from_: Optional[str], to: Optional[str]):
    if from_:
        d1 = date.fromisoformat(from_)
    else:
        today = date.today()
        d1 = today.replace(day=1)

    if to:
        d2 = date.fromisoformat(to)
    else:
        next_month_first = (d1.replace(day=MONTH_END_CALC_DAY) + timedelta(days=MONTH_END_CALC_OFFSET)).replace(day=1)
        d2 = next_month_first - timedelta(days=1)

    return d1, d2


# ===== Routes =====

@router.get("", response_model=List[TransactionOut])
def list_transactions(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d1, d2 = _dates(date_from, date_to)

    q = (
        select(BudgetTransaction, BudgetCategory)
        .outerjoin(BudgetCategory, BudgetCategory.id == BudgetTransaction.category_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
        .order_by(BudgetTransaction.occurred_at.desc(), BudgetTransaction.id.desc())
    )

    rows = db.execute(q).all()
    out: List[TransactionOut] = []
    for bt, cat in rows:
        # Расшифровываем сумму (используем зашифрованную, если есть, иначе старую)
        if bt.amount_encrypted:
            decrypted_amount = decrypt_amount(bt.amount_encrypted)
        else:
            # Обратная совместимость со старыми записями
            decrypted_amount = bt.amount
        
        out.append(
            TransactionOut(
                id=bt.id,
                type=bt.type,
                account_id=bt.account_id,
                contra_account_id=bt.contra_account_id,
                category_id=bt.category_id,
                category=(CategoryOut(id=cat.id, name=cat.name) if cat else None),
                amount=float(decrypted_amount),
                currency=bt.currency,
                occurred_at=bt.occurred_at.isoformat() if hasattr(bt.occurred_at, "isoformat") else str(bt.occurred_at),
                description=bt.description,
            )
        )
    return out


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Создание операции.
    ВАЖНО: для transfer разрешены оба направления:
      - обычный -> накопительный (пополнение)
      - накопительный -> обычный (снятие)
    Запрещён перевод в тот же самый счёт.
    Оба счёта должны принадлежать пользователю и быть активными.
    """
    if payload.type == TRANSACTION_TYPE_TRANSFER:
        if not payload.contra_account_id or payload.contra_account_id == payload.account_id:
            raise HTTPException(HTTP_400_BAD_REQUEST, detail=ERROR_INVALID_TRANSFER_PARAMS)

        acc_from: BudgetAccount | None = db.get(BudgetAccount, payload.account_id)
        acc_to: BudgetAccount | None = db.get(BudgetAccount, payload.contra_account_id)

        if not acc_from or not acc_to or acc_from.user_id != user.id or acc_to.user_id != user.id:
            raise HTTPException(HTTP_400_BAD_REQUEST, detail=ERROR_ACCOUNTS_UNAVAILABLE)
        if getattr(acc_from, "is_active", True) is False or getattr(acc_to, "is_active", True) is False:
            raise HTTPException(HTTP_400_BAD_REQUEST, detail=ERROR_ACCOUNT_INACTIVE)

        tx = BudgetTransaction(
            user_id=user.id,
            type=TRANSACTION_TYPE_TRANSFER,
            account_id=acc_from.id,
            contra_account_id=acc_to.id,
            category_id=None,
            amount=payload.amount,  # Оставляем для обратной совместимости
            amount_encrypted=encrypt_amount(payload.amount),  # Шифруем сумму
            currency=payload.currency,
            occurred_at=payload.occurred_at or date.today(),
            description=payload.description or None,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

    elif payload.type in (TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_EXPENSE):
        if not payload.category_id:
            type_name = "доходов" if payload.type == TRANSACTION_TYPE_INCOME else "расходов"
            raise HTTPException(HTTP_400_BAD_REQUEST, detail=ERROR_CATEGORY_REQUIRED_TEMPLATE.format(type_name=type_name))

        category: BudgetCategory | None = db.get(BudgetCategory, payload.category_id)
        account: BudgetAccount | None = db.get(BudgetAccount, payload.account_id)

        if not category or not account or account.user_id != user.id or category.user_id != user.id:
            raise HTTPException(HTTP_400_BAD_REQUEST, detail=ERROR_ACCOUNTS_UNAVAILABLE)

        tx = BudgetTransaction(
            user_id=user.id,
            type=payload.type,
            account_id=account.id,
            contra_account_id=None,
            category_id=category.id,
            amount=payload.amount,  # Оставляем для обратной совместимости
            amount_encrypted=encrypt_amount(payload.amount),  # Шифруем сумму
            currency=payload.currency,
            occurred_at=payload.occurred_at or date.today(),
            description=payload.description or None,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

    else:
        raise HTTPException(HTTP_400_BAD_REQUEST, detail=ERROR_UNKNOWN_TRANSACTION_TYPE)

    cat = None
    if tx.category_id:
        c = db.get(BudgetCategory, tx.category_id)
        if c:
            cat = CategoryOut(id=c.id, name=c.name)

    # Расшифровываем сумму (используем зашифрованную, если есть, иначе старую)
    if tx.amount_encrypted:
        decrypted_amount = decrypt_amount(tx.amount_encrypted)
    else:
        # Обратная совместимость со старыми записями
        decrypted_amount = tx.amount
    
    return TransactionOut(
        id=tx.id,
        type=tx.type,
        account_id=tx.account_id,
        contra_account_id=tx.contra_account_id,
        category_id=tx.category_id,
        category=cat,
        amount=float(decrypted_amount),
        currency=tx.currency,
        occurred_at=tx.occurred_at.isoformat() if hasattr(tx.occurred_at, "isoformat") else str(tx.occurred_at),
        description=tx.description,
    )


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Удалить транзакцию."""
    tx = db.get(BudgetTransaction, transaction_id)
    if not tx or tx.user_id != user.id:
        raise HTTPException(HTTP_404_NOT_FOUND, detail=ERROR_TRANSACTION_NOT_FOUND)
    
    db.delete(tx)
    db.commit()
    return {"status": "ok"}