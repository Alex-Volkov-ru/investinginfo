from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from sqlalchemy import select, func, case
from sqlalchemy.orm import Session, aliased

from app.backend.core.auth import get_current_user
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import (
    BudgetTransaction,
    BudgetAccount,
    BudgetCategory,
)

router = APIRouter(prefix="/budget/summary", tags=["budget: summary"])


# ===== Schemas =====

class MonthSummaryOut(BaseModel):
    income_total: float
    expense_total: float
    net_total: float
    savings_transferred: float
    savings: float


class ChartSlice(BaseModel):
    name: str
    amount: float


class ChartsOut(BaseModel):
    income_by_category: List[ChartSlice]
    expense_by_category: List[ChartSlice]
    expense_by_day: List[ChartSlice]


# ===== Helpers =====

def _dates(from_: Optional[str], to: Optional[str]):
    """
    Возвращает (d1, d2) — обе даты включительно.
    Если date_to не задан, d2 = последний день месяца d1.
    """
    if from_:
        d1 = date.fromisoformat(from_)
    else:
        today = date.today()
        d1 = today.replace(day=1)

    if to:
        d2 = date.fromisoformat(to)
    else:
        next_month_first = (d1.replace(day=28) + timedelta(days=4)).replace(day=1)
        d2 = next_month_first - timedelta(days=1)

    return d1, d2


# ===== Routes =====

@router.get("/month", response_model=MonthSummaryOut)
def month_summary(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d1, d2 = _dates(date_from, date_to)

    income = db.scalar(
        select(func.coalesce(func.sum(BudgetTransaction.amount), 0))
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "income",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ) or Decimal(0)

    expense = db.scalar(
        select(func.coalesce(func.sum(BudgetTransaction.amount), 0))
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "expense",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ) or Decimal(0)

    savings_in = db.scalar(
        select(func.coalesce(func.sum(BudgetTransaction.amount), 0))
        .join(BudgetAccount, BudgetAccount.id == BudgetTransaction.contra_account_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "transfer",
            BudgetAccount.is_savings.is_(True),
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ) or Decimal(0)

    AccFrom = aliased(BudgetAccount)
    AccTo = aliased(BudgetAccount)

    savings_net = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (AccTo.is_savings.is_(True), BudgetTransaction.amount),
                        (AccFrom.is_savings.is_(True), -BudgetTransaction.amount),
                        else_=0,
                    )
                ),
                0,
            )
        )
        .join(AccFrom, AccFrom.id == BudgetTransaction.account_id)
        .join(AccTo,   AccTo.id   == BudgetTransaction.contra_account_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "transfer",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ) or Decimal(0)

    return MonthSummaryOut(
        income_total=float(income),
        expense_total=float(expense),
        net_total=float(income - expense),
        savings_transferred=float(savings_in),
        savings=float(savings_net),
    )


@router.get("/charts", response_model=ChartsOut)
def charts(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d1, d2 = _dates(date_from, date_to)

    # income by category
    rs_inc = db.execute(
        select(BudgetCategory.name, func.coalesce(func.sum(BudgetTransaction.amount), 0))
        .join(BudgetCategory, BudgetCategory.id == BudgetTransaction.category_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "income",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
        .group_by(BudgetCategory.name)
        .order_by(BudgetCategory.name)
    ).all()

    rs_exp = db.execute(
        select(BudgetCategory.name, func.coalesce(func.sum(BudgetTransaction.amount), 0))
        .join(BudgetCategory, BudgetCategory.id == BudgetTransaction.category_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "expense",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
        .group_by(BudgetCategory.name)
        .order_by(BudgetCategory.name)
    ).all()

    rs_day = db.execute(
        select(BudgetTransaction.occurred_at, func.coalesce(func.sum(BudgetTransaction.amount), 0))
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "expense",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
        .group_by(BudgetTransaction.occurred_at)
        .order_by(BudgetTransaction.occurred_at.asc())
    ).all()

    return ChartsOut(
        income_by_category=[{"name": n, "amount": float(v)} for (n, v) in rs_inc],
        expense_by_category=[{"name": n, "amount": float(v)} for (n, v) in rs_exp],
        expense_by_day=[{"name": d.isoformat(), "amount": float(v)} for (d, v) in rs_day],
    )
