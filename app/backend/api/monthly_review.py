from __future__ import annotations

from datetime import date, datetime, timedelta, time
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.core.security import decrypt_amount
from app.backend.core.constants import TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_EXPENSE
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.budget import (
    BudgetTransaction,
    BudgetCategory,
    ObligationBlock,
    ObligationPayment,
)
from app.backend.models.portfolio import Portfolio, Position
from app.backend.api.budget_obligation_blocks import _calc_metrics_exact

router = APIRouter(prefix="/monthly-review", tags=["monthly review"])


class CategoryLimitStatus(BaseModel):
    category_id: int
    category_name: str
    monthly_limit: float
    spent: float
    percentage: float
    is_over_limit: bool


class BudgetReview(BaseModel):
    total_income: float
    total_expense: float
    net_result: float
    categories_with_limits: int
    categories_within_limit: int
    categories_over_limit: int
    over_limit_categories: List[CategoryLimitStatus]
    top_over_limit: List[CategoryLimitStatus]


class InvestmentReview(BaseModel):
    has_portfolio: bool = False
    portfolios_count: int = 0
    positions_count: int = 0


class ObligationBlockSummary(BaseModel):
    block_id: int
    title: str
    payments_in_month_count: int
    payments_in_month_amount: float
    remaining: float
    progress_pct: float


class ObligationReview(BaseModel):
    paid_count: int
    total_payment_amount: float
    blocks: List[ObligationBlockSummary]
    upcoming_payments_count: int
    upcoming_payments_amount: float


class MonthlyReviewOut(BaseModel):
    month: int
    year: int
    budget: BudgetReview
    investments: InvestmentReview
    obligations: ObligationReview


def _get_decrypted_amount(tx: BudgetTransaction) -> Decimal:
    if tx.amount_encrypted:
        return decrypt_amount(tx.amount_encrypted)
    return tx.amount


@router.get("", response_model=MonthlyReviewOut)
def get_monthly_review(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    year: Optional[int] = Query(None, description="Год обзора (например 2026)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Месяц обзора (1–12)"),
):
    today = date.today()
    first_day_current = today.replace(day=1)

    if year is not None and month is not None:
        review_month = date(year, month, 1)
    else:
        if today.day <= 5:
            review_month = first_day_current - timedelta(days=1)
            review_month = review_month.replace(day=1)
        else:
            review_month = first_day_current

    month_start = review_month
    month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    
    month_start_dt = datetime.combine(month_start, time.min)
    month_end_dt = datetime.combine(month_end, time.max)
    
    transactions = db.execute(
        select(BudgetTransaction)
        .where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.occurred_at >= month_start_dt,
            BudgetTransaction.occurred_at <= month_end_dt,
        )
    ).scalars().all()
    
    income_total = sum(
        float(_get_decrypted_amount(tx)) for tx in transactions
        if tx.type == TRANSACTION_TYPE_INCOME
    )
    
    expense_total = sum(
        float(_get_decrypted_amount(tx)) for tx in transactions
        if tx.type == TRANSACTION_TYPE_EXPENSE
    )
    
    net_result = income_total - expense_total
    
    categories_with_limits = db.execute(
        select(BudgetCategory)
        .where(
            BudgetCategory.user_id == user.id,
            BudgetCategory.kind == TRANSACTION_TYPE_EXPENSE,
            BudgetCategory.is_active.is_(True),
            BudgetCategory.monthly_limit.isnot(None),
        )
    ).scalars().all()
    
    category_statuses = []
    for cat in categories_with_limits:
        cat_transactions = [
            tx for tx in transactions
            if tx.category_id == cat.id and tx.type == TRANSACTION_TYPE_EXPENSE
        ]
        spent = sum(float(_get_decrypted_amount(tx)) for tx in cat_transactions)
        limit = float(cat.monthly_limit or 0)
        percentage = (spent / limit * 100) if limit > 0 else 0
        is_over = spent > limit
        
        category_statuses.append(CategoryLimitStatus(
            category_id=cat.id,
            category_name=cat.name,
            monthly_limit=limit,
            spent=spent,
            percentage=percentage,
            is_over_limit=is_over,
        ))
    
    categories_within_limit = sum(1 for cs in category_statuses if not cs.is_over_limit)
    categories_over_limit = sum(1 for cs in category_statuses if cs.is_over_limit)
    over_limit_categories = [cs for cs in category_statuses if cs.is_over_limit]
    top_over_limit = sorted(over_limit_categories, key=lambda x: x.spent - x.monthly_limit, reverse=True)[:3]
    
    budget_review = BudgetReview(
        total_income=income_total,
        total_expense=expense_total,
        net_result=net_result,
        categories_with_limits=len(category_statuses),
        categories_within_limit=categories_within_limit,
        categories_over_limit=categories_over_limit,
        over_limit_categories=over_limit_categories,
        top_over_limit=top_over_limit,
    )
    
    portfolios = db.execute(
        select(Portfolio)
        .where(Portfolio.user_id == user.id)
    ).scalars().all()
    
    portfolios_count = len(portfolios)
    positions_count = sum(
        len(db.execute(select(Position).where(Position.portfolio_id == p.id)).scalars().all())
        for p in portfolios
    )
    investment_review = InvestmentReview(
        has_portfolio=portfolios_count > 0,
        portfolios_count=portfolios_count,
        positions_count=positions_count,
    )

    obligation_blocks = db.execute(
        select(ObligationBlock)
        .where(
            ObligationBlock.user_id == user.id,
            ObligationBlock.status == "Активный",
        )
    ).scalars().all()

    paid_count = 0
    total_payment_amount = 0.0
    block_summaries: List[ObligationBlockSummary] = []

    for block in obligation_blocks:
        in_month_count = 0
        in_month_amount = 0.0
        for p in block.payments or []:
            if not p.date or not (month_start <= p.date <= month_end):
                continue
            if p.ok:
                in_month_count += 1
                in_month_amount += float(p.amount or 0)
        paid_count += in_month_count
        total_payment_amount += in_month_amount

        metrics = _calc_metrics_exact(block)
        block_summaries.append(ObligationBlockSummary(
            block_id=block.id,
            title=block.title or "",
            payments_in_month_count=in_month_count,
            payments_in_month_amount=in_month_amount,
            remaining=metrics["remaining"],
            progress_pct=metrics["progress_pct"],
        ))

    next_month_start = (month_end + timedelta(days=1))
    next_month_end = (next_month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

    upcoming_payments_count = 0
    upcoming_payments_amount = 0.0

    for block in obligation_blocks:
        if block.next_payment and next_month_start <= block.next_payment <= next_month_end:
            upcoming_payments_count += 1
            upcoming_payments_amount += float(block.monthly or 0)

    obligation_review = ObligationReview(
        paid_count=paid_count,
        total_payment_amount=total_payment_amount,
        blocks=block_summaries,
        upcoming_payments_count=upcoming_payments_count,
        upcoming_payments_amount=upcoming_payments_amount,
    )
    
    return MonthlyReviewOut(
        month=review_month.month,
        year=review_month.year,
        budget=budget_review,
        investments=investment_review,
        obligations=obligation_review,
    )
