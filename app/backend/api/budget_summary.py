from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from sqlalchemy import select, func, case
from sqlalchemy.orm import Session, aliased

from app.backend.core.auth import get_current_user
from app.backend.core.security import decrypt_amount
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


class YearSummaryOut(BaseModel):
    year: int
    income_total: float
    expense_total: float
    net_total: float
    savings_transferred: float
    savings: float
    income_by_category: List[ChartSlice]
    expense_by_category: List[ChartSlice]
    monthly_data: List[dict]  # [{month: 1, income: 100, expense: 50}, ...]


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

def _get_decrypted_amount(tx: BudgetTransaction) -> Decimal:
    """Получить расшифрованную сумму транзакции."""
    if tx.amount_encrypted:
        return decrypt_amount(tx.amount_encrypted)
    else:
        # Обратная совместимость со старыми записями
        return tx.amount


@router.get("/month", response_model=MonthSummaryOut)
def month_summary(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d1, d2 = _dates(date_from, date_to)

    # Загружаем транзакции и расшифровываем суммы на уровне приложения
    income_txs = db.scalars(
        select(BudgetTransaction)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "income",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ).all()
    income = sum(_get_decrypted_amount(tx) for tx in income_txs)

    expense_txs = db.scalars(
        select(BudgetTransaction)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "expense",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ).all()
    expense = sum(_get_decrypted_amount(tx) for tx in expense_txs)

    # Переводы на сберегательные счета
    savings_txs = db.scalars(
        select(BudgetTransaction)
        .join(BudgetAccount, BudgetAccount.id == BudgetTransaction.contra_account_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "transfer",
            BudgetAccount.is_savings.is_(True),
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ).all()
    savings_in = sum(_get_decrypted_amount(tx) for tx in savings_txs)

    # Чистые сбережения (входящие - исходящие)
    AccFrom = aliased(BudgetAccount)
    AccTo = aliased(BudgetAccount)
    all_transfer_txs = db.scalars(
        select(BudgetTransaction)
        .join(AccFrom, AccFrom.id == BudgetTransaction.account_id)
        .join(AccTo, AccTo.id == BudgetTransaction.contra_account_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "transfer",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ).all()
    
    savings_net = Decimal(0)
    for tx in all_transfer_txs:
        amount = _get_decrypted_amount(tx)
        acc_from = db.get(BudgetAccount, tx.account_id)
        acc_to = db.get(BudgetAccount, tx.contra_account_id)
        if acc_to and acc_to.is_savings:
            savings_net += amount
        elif acc_from and acc_from.is_savings:
            savings_net -= amount

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

    # Загружаем транзакции с категориями и расшифровываем суммы
    income_txs = db.scalars(
        select(BudgetTransaction)
        .join(BudgetCategory, BudgetCategory.id == BudgetTransaction.category_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "income",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ).all()
    
    income_by_cat: dict[str, Decimal] = {}
    for tx in income_txs:
        cat = db.get(BudgetCategory, tx.category_id)
        if cat:
            amount = _get_decrypted_amount(tx)
            income_by_cat[cat.name] = income_by_cat.get(cat.name, Decimal(0)) + amount

    expense_txs = db.scalars(
        select(BudgetTransaction)
        .join(BudgetCategory, BudgetCategory.id == BudgetTransaction.category_id)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "expense",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ).all()
    
    expense_by_cat: dict[str, Decimal] = {}
    for tx in expense_txs:
        cat = db.get(BudgetCategory, tx.category_id)
        if cat:
            amount = _get_decrypted_amount(tx)
            expense_by_cat[cat.name] = expense_by_cat.get(cat.name, Decimal(0)) + amount

    # Расходы по дням
    expense_day_txs = db.scalars(
        select(BudgetTransaction)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.type == "expense",
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ).all()
    
    expense_by_day: dict[date, Decimal] = {}
    for tx in expense_day_txs:
        day = tx.occurred_at.date() if hasattr(tx.occurred_at, "date") else tx.occurred_at
        amount = _get_decrypted_amount(tx)
        expense_by_day[day] = expense_by_day.get(day, Decimal(0)) + amount

    return ChartsOut(
        income_by_category=[{"name": n, "amount": float(v)} for n, v in sorted(income_by_cat.items())],
        expense_by_category=[{"name": n, "amount": float(v)} for n, v in sorted(expense_by_cat.items())],
        expense_by_day=[{"name": d.isoformat(), "amount": float(v)} for d, v in sorted(expense_by_day.items())],
    )


@router.get("/year", response_model=YearSummaryOut)
def year_summary(
    year: int = Query(..., description="Год (например, 2024)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Годовая статистика: доходы, расходы, категории, данные по месяцам."""
    d1 = date(year, 1, 1)
    d2 = date(year, 12, 31)

    # Загружаем все транзакции за год и расшифровываем суммы
    all_txs = db.scalars(
        select(BudgetTransaction)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        )
    ).all()

    income = Decimal(0)
    expense = Decimal(0)
    savings_in = Decimal(0)
    savings_net = Decimal(0)
    income_by_cat: dict[str, Decimal] = {}
    expense_by_cat: dict[str, Decimal] = {}
    monthly_data_dict: dict[int, dict[str, Decimal]] = {m: {"income": Decimal(0), "expense": Decimal(0), "savings": Decimal(0)} for m in range(1, 13)}

    for tx in all_txs:
        amount = _get_decrypted_amount(tx)
        tx_month = tx.occurred_at.month if hasattr(tx.occurred_at, "month") else (tx.occurred_at.date().month if hasattr(tx.occurred_at, "date") else 1)

        if tx.type == "income":
            income += amount
            monthly_data_dict[tx_month]["income"] += amount
            if tx.category_id:
                cat = db.get(BudgetCategory, tx.category_id)
                if cat:
                    income_by_cat[cat.name] = income_by_cat.get(cat.name, Decimal(0)) + amount

        elif tx.type == "expense":
            expense += amount
            monthly_data_dict[tx_month]["expense"] += amount
            if tx.category_id:
                cat = db.get(BudgetCategory, tx.category_id)
                if cat:
                    expense_by_cat[cat.name] = expense_by_cat.get(cat.name, Decimal(0)) + amount

        elif tx.type == "transfer":
            acc_to = db.get(BudgetAccount, tx.contra_account_id) if tx.contra_account_id else None
            acc_from = db.get(BudgetAccount, tx.account_id) if tx.account_id else None
            
            if acc_to and acc_to.is_savings:
                savings_in += amount
                savings_net += amount
                monthly_data_dict[tx_month]["savings"] += amount
            elif acc_from and acc_from.is_savings:
                savings_net -= amount
                monthly_data_dict[tx_month]["savings"] -= amount

    # Формируем данные по месяцам
    monthly_data = []
    for month in range(1, 13):
        month_data = monthly_data_dict[month]
        monthly_data.append({
            "month": month,
            "income": float(month_data["income"]),
            "expense": float(month_data["expense"]),
            "net": float(month_data["income"] - month_data["expense"]),
            "savings": float(month_data["savings"]),
        })

    # Сортируем категории по сумме
    income_by_cat_sorted = sorted(income_by_cat.items(), key=lambda x: x[1], reverse=True)
    expense_by_cat_sorted = sorted(expense_by_cat.items(), key=lambda x: x[1], reverse=True)

    return YearSummaryOut(
        year=year,
        income_total=float(income),
        expense_total=float(expense),
        net_total=float(income - expense),
        savings_transferred=float(savings_in),
        savings=float(savings_net),
        income_by_category=[{"name": n, "amount": float(v)} for (n, v) in income_by_cat_sorted],
        expense_by_category=[{"name": n, "amount": float(v)} for (n, v) in expense_by_cat_sorted],
        monthly_data=monthly_data,
    )
