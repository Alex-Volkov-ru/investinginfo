from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import BudgetAccount, BudgetTransaction

router = APIRouter(prefix="/budget/summary", tags=["budget"])


class AccountBalance(BaseModel):
    account_id: int
    account_title: str
    currency: str
    balance_delta: float


class TotalsOut(BaseModel):
    income_total: float
    expense_total: float
    net_total: float
    accounts: List[AccountBalance]


@router.get("", response_model=TotalsOut)
def summary(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # итоги пользователя (без transfer)
    q = db.query(
        func.coalesce(func.sum(case((BudgetTransaction.type == "income", BudgetTransaction.amount), else_=0)), 0),
        func.coalesce(func.sum(case((BudgetTransaction.type == "expense", BudgetTransaction.amount), else_=0)), 0),
    ).filter(BudgetTransaction.user_id == user.id)

    if date_from:
        q = q.filter(BudgetTransaction.occurred_at >= date_from)
    if date_to:
        q = q.filter(BudgetTransaction.occurred_at < date_to)

    income, expense = q.first() or (0, 0)
    net = float(income) - float(expense)

    # остаток по счетам (доходы - расходы; transfer не влияет)
    aq = db.query(
        BudgetAccount.id,
        BudgetAccount.title,
        BudgetAccount.currency,
        func.coalesce(func.sum(
            case(
                (BudgetTransaction.type == "income", BudgetTransaction.amount),
                (BudgetTransaction.type == "expense", -BudgetTransaction.amount),
                else_=0
            )
        ), 0)
    ).outerjoin(
        BudgetTransaction, BudgetTransaction.account_id == BudgetAccount.id
    ).filter(
        BudgetAccount.user_id == user.id,
        BudgetAccount.archived_at.is_(None)
    )

    if date_from:
        aq = aq.filter((BudgetTransaction.occurred_at.is_(None)) | (BudgetTransaction.occurred_at >= date_from))
    if date_to:
        aq = aq.filter((BudgetTransaction.occurred_at.is_(None)) | (BudgetTransaction.occurred_at < date_to))

    aq = aq.group_by(BudgetAccount.id, BudgetAccount.title, BudgetAccount.currency).order_by(BudgetAccount.id)

    accounts = [
        AccountBalance(
            account_id=aid,
            account_title=title,
            currency=cur,
            balance_delta=float(bal or 0),
        )
        for (aid, title, cur, bal) in aq.all()
    ]

    return TotalsOut(
        income_total=float(income or 0),
        expense_total=float(expense or 0),
        net_total=net,
        accounts=accounts
    )
