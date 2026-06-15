from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, and_, or_, cast
from sqlalchemy.types import Date
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from tinkoff.invest import Client

from app.backend.core.auth import get_staff_user, create_access_token, create_impersonation_token
from app.backend.core.config import get_settings
from app.backend.core.security import decrypt_token, decrypt_amount
from app.backend.core.constants import (
    TRANSACTION_TYPE_INCOME,
    TRANSACTION_TYPE_EXPENSE,
    ERROR_USER_NOT_FOUND,
    HTTP_404_NOT_FOUND,
)
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.portfolio import Portfolio, Position
from app.backend.models.instrument import Instrument
from app.backend.models.budget import (
    BudgetTransaction,
    BudgetCategory,
    BudgetObligation,
    ObligationBlock,
    ObligationPayment,
)
from app.backend.models.whiteboard import Whiteboard
from app.backend.models.admin import AdminAuditLog, AdminCategoryTemplate, AdminObligationTemplate
from app.backend.services.admin_audit import log_admin_action
from app.backend.routes.market import (
    refresh_instruments_cache,
    _get_last_prices_blocking,
    _normalize_quote,
    FIGI_CACHE,
    settings as market_settings,
)

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()


# ===== Helpers =====

def _tx_amount(tx: BudgetTransaction) -> float:
    if tx.amount_encrypted:
        return float(decrypt_amount(tx.amount_encrypted))
    return float(tx.amount or 0)


def _month_range(year: int, month: int) -> tuple[date, date]:
    d1 = date(year, month, 1)
    if month == 12:
        d2 = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        d2 = date(year, month + 1, 1) - timedelta(days=1)
    return d1, d2


def _user_or_404(db: Session, user_id: int) -> User:
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(HTTP_404_NOT_FOUND, ERROR_USER_NOT_FOUND)
    return u


# ===== Investments schemas =====

class PortfolioUserSummary(BaseModel):
    user_id: int
    email: str
    tg_username: Optional[str] = None
    portfolios_count: int
    positions_count: int
    portfolio_value: float
    last_position_update: Optional[datetime] = None


class InvestmentsOverviewOut(BaseModel):
    users: List[PortfolioUserSummary]
    total_value: float
    total_positions: int


class TinkoffStatusItem(BaseModel):
    user_id: int
    email: str
    has_token: bool
    status: str  # ok | no_token | error
    message: Optional[str] = None
    checked_at: Optional[datetime] = None


class ProblemPosition(BaseModel):
    user_id: int
    email: str
    position_id: int
    portfolio_id: int
    figi: str
    ticker: Optional[str] = None
    issue: str


class AssetClassSlice(BaseModel):
    asset_class: str
    count: int
    value: float
    percentage: float


class RefreshQuotesResult(BaseModel):
    updated: int
    failed: int
    errors: List[str]


# ===== Budget schemas =====

class BudgetUserDashboard(BaseModel):
    user_id: int
    email: str
    income: float
    expense: float
    net: float
    top_expense_category: Optional[str] = None
    over_limit_categories: int


class BudgetDashboardOut(BaseModel):
    year: int
    month: int
    users: List[BudgetUserDashboard]
    totals: dict


class BudgetAnomaly(BaseModel):
    user_id: int
    email: str
    kind: str
    message: str
    amount: Optional[float] = None


class CategoryTemplateIn(BaseModel):
    kind: str
    name: str
    monthly_limit: Optional[float] = None
    apply_to_new_users: bool = False


class CategoryTemplateOut(CategoryTemplateIn):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminTransactionOut(BaseModel):
    id: int
    user_id: int
    email: str
    type: str
    amount: float
    currency: str
    occurred_at: datetime
    category_name: Optional[str] = None
    description: Optional[str] = None


class BudgetCompareOut(BaseModel):
    user_a: dict
    user_b: dict


class WhiteboardStat(BaseModel):
    user_id: int
    email: str
    boards_count: int
    last_updated: Optional[datetime] = None


class MonthStatusItem(BaseModel):
    user_id: int
    email: str
    has_activity: bool
    transaction_count: int
    income: float
    expense: float


# ===== Obligations schemas =====

class ObligationSummaryItem(BaseModel):
    user_id: int
    email: str
    block_id: int
    title: str
    monthly: float
    remaining: float
    status: str
    next_payment: Optional[date] = None


class CalendarPayment(BaseModel):
    user_id: int
    email: str
    date: date
    title: str
    amount: float
    kind: str  # block | simple


class ObligationRisk(BaseModel):
    user_id: int
    email: str
    kind: str
    title: str
    message: str
    amount: Optional[float] = None
    due_date: Optional[date] = None


class ObligationTemplateIn(BaseModel):
    title: str
    total: float = 0
    monthly: float = 0
    rate: float = 0
    due_day: int = 1
    notes: str = ""


class ObligationTemplateOut(ObligationTemplateIn):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== Users schemas =====

class UserDetailOut(BaseModel):
    id: int
    email: str
    tg_username: Optional[str] = None
    is_staff: bool
    has_tinkoff: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    portfolios_count: int
    positions_count: int
    transactions_count: int
    whiteboards_count: int
    obligation_blocks_count: int
    categories_count: int


class ImpersonateOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    tg_username: Optional[str] = None
    impersonated_by: int


class AuditLogItem(BaseModel):
    id: int
    admin_id: int
    admin_email: str
    action: str
    target_user_id: Optional[int] = None
    target_email: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime


class BulkExportIn(BaseModel):
    user_ids: List[int] = Field(default_factory=list)


# ===== INVESTMENTS =====

@router.get("/investments/overview", response_model=InvestmentsOverviewOut)
def investments_overview(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    result: List[PortfolioUserSummary] = []
    total_value = 0.0
    total_positions = 0

    for u in users:
        portfolios = db.query(Portfolio).filter(Portfolio.user_id == u.id).all()
        pf_ids = [p.id for p in portfolios]
        positions_count = 0
        portfolio_value = 0.0
        last_update: Optional[datetime] = None

        if pf_ids:
            rows = (
                db.query(Position, Instrument)
                .join(Instrument, Instrument.figi == Position.figi, isouter=True)
                .filter(Position.portfolio_id.in_(pf_ids))
                .all()
            )
            positions_count = len(rows)
            for pos, inst in rows:
                qty = float(pos.quantity or 0)
                avg = float(pos.avg_price or 0)
                portfolio_value += qty * avg
                if pos.updated_at and (last_update is None or pos.updated_at > last_update):
                    last_update = pos.updated_at

        total_value += portfolio_value
        total_positions += positions_count
        result.append(
            PortfolioUserSummary(
                user_id=u.id,
                email=u.email,
                tg_username=u.tg_username,
                portfolios_count=len(portfolios),
                positions_count=positions_count,
                portfolio_value=round(portfolio_value, 2),
                last_position_update=last_update,
            )
        )

    return InvestmentsOverviewOut(users=result, total_value=round(total_value, 2), total_positions=total_positions)


@router.get("/investments/tinkoff-status", response_model=List[TinkoffStatusItem])
def tinkoff_status(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    out: List[TinkoffStatusItem] = []
    for u in users:
        has = u.has_tinkoff_token
        out.append(
            TinkoffStatusItem(
                user_id=u.id,
                email=u.email,
                has_token=has,
                status="no_token" if not has else "unknown",
            )
        )
    return out


@router.post("/investments/tinkoff-check/{user_id}", response_model=TinkoffStatusItem)
async def tinkoff_check_user(
    user_id: int,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    u = _user_or_404(db, user_id)
    if not u.has_tinkoff_token:
        return TinkoffStatusItem(user_id=u.id, email=u.email, has_token=False, status="no_token")

    token = decrypt_token(u.tinkoff_token_enc or "")
    try:
        def _check():
            with Client(token) as client:
                client.users.get_accounts()

        await run_in_threadpool(_check)
        log_admin_action(db, admin, "tinkoff_check", u.id, {"status": "ok"})
        return TinkoffStatusItem(
            user_id=u.id,
            email=u.email,
            has_token=True,
            status="ok",
            message="Токен работает",
            checked_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        log_admin_action(db, admin, "tinkoff_check", u.id, {"status": "error", "error": str(e)})
        return TinkoffStatusItem(
            user_id=u.id,
            email=u.email,
            has_token=True,
            status="error",
            message=str(e)[:200],
            checked_at=datetime.now(timezone.utc),
        )


@router.get("/investments/problems", response_model=List[ProblemPosition])
def investment_problems(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    problems: List[ProblemPosition] = []
    rows = (
        db.query(Position, Instrument, Portfolio, User)
        .join(Portfolio, Portfolio.id == Position.portfolio_id)
        .join(User, User.id == Portfolio.user_id)
        .outerjoin(Instrument, Instrument.figi == Position.figi)
        .all()
    )
    seen_figi: dict[tuple[int, str], int] = {}
    for pos, inst, pf, user in rows:
        issues: list[str] = []
        if not inst:
            issues.append("instrument_not_found")
        if float(pos.quantity or 0) == 0:
            issues.append("zero_quantity")
        if not pos.figi:
            issues.append("missing_figi")
        key = (pf.user_id, pos.figi)
        if key in seen_figi:
            issues.append("duplicate_figi")
        seen_figi[key] = pos.id
        for issue in issues:
            problems.append(
                ProblemPosition(
                    user_id=user.id,
                    email=user.email,
                    position_id=pos.id,
                    portfolio_id=pf.id,
                    figi=pos.figi,
                    ticker=inst.ticker if inst else None,
                    issue=issue,
                )
            )
    return problems


@router.get("/investments/asset-classes", response_model=List[AssetClassSlice])
def investment_asset_classes(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Position, Instrument)
        .join(Instrument, Instrument.figi == Position.figi, isouter=True)
        .all()
    )
    by_class: dict[str, dict[str, float]] = {}
    for pos, inst in rows:
        cls = (inst.class_ if inst and inst.class_ else "unknown") or "unknown"
        val = float(pos.quantity or 0) * float(pos.avg_price or 0)
        if cls not in by_class:
            by_class[cls] = {"count": 0, "value": 0.0}
        by_class[cls]["count"] += 1
        by_class[cls]["value"] += val

    total = sum(v["value"] for v in by_class.values()) or 1.0
    return [
        AssetClassSlice(
            asset_class=k,
            count=int(v["count"]),
            value=round(v["value"], 2),
            percentage=round(v["value"] / total * 100, 1),
        )
        for k, v in sorted(by_class.items(), key=lambda x: -x[1]["value"])
    ]


@router.post("/investments/refresh-quotes", response_model=RefreshQuotesResult)
async def refresh_quotes(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    user_id: Optional[int] = Query(None),
):
    token = market_settings.TINKOFF_TOKEN
    if not token and user_id:
        u = _user_or_404(db, user_id)
        if u.has_tinkoff_token:
            token = decrypt_token(u.tinkoff_token_enc or "")
    if not token:
        admin_user = db.query(User).filter(User.tinkoff_token_enc.isnot(None)).first()
        if admin_user:
            token = decrypt_token(admin_user.tinkoff_token_enc or "")

    if not token:
        raise HTTPException(400, "Нет доступного Tinkoff токена для обновления котировок")

    figis = [r[0] for r in db.query(Position.figi).distinct().all() if r[0]]
    if not figis:
        return RefreshQuotesResult(updated=0, failed=0, errors=[])

    await run_in_threadpool(refresh_instruments_cache, token)
    updated = 0
    failed = 0
    errors: list[str] = []
    batch_size = 50
    for i in range(0, len(figis), batch_size):
        batch = figis[i : i + batch_size]
        try:
            prices = await run_in_threadpool(_get_last_prices_blocking, batch, token)
            updated += len(prices)
        except Exception as e:
            failed += len(batch)
            errors.append(str(e)[:100])

    log_admin_action(db, admin, "refresh_quotes", user_id, {"updated": updated, "failed": failed})
    return RefreshQuotesResult(updated=updated, failed=failed, errors=errors[:10])


@router.get("/investments/export")
def export_portfolios(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(User, Portfolio, Position, Instrument)
        .join(Portfolio, Portfolio.user_id == User.id)
        .join(Position, Position.portfolio_id == Portfolio.id)
        .outerjoin(Instrument, Instrument.figi == Position.figi)
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["user_id", "email", "portfolio", "figi", "ticker", "name", "class", "quantity", "avg_price", "value"])
    for user, pf, pos, inst in rows:
        qty = float(pos.quantity or 0)
        avg = float(pos.avg_price or 0)
        writer.writerow([
            user.id, user.email, pf.title, pos.figi,
            inst.ticker if inst else "", inst.name if inst else "", inst.class_ if inst else "",
            qty, avg, round(qty * avg, 2),
        ])
    log_admin_action(db, admin, "export_portfolios")
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=portfolios_export.csv"},
    )


# ===== BUDGET =====

@router.get("/budget/dashboard", response_model=BudgetDashboardOut)
def budget_dashboard(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    d1, d2 = _month_range(y, m)

    users = db.query(User).all()
    dashboard: List[BudgetUserDashboard] = []
    total_income = 0.0
    total_expense = 0.0

    for u in users:
        txs = (
            db.query(BudgetTransaction, BudgetCategory)
            .outerjoin(BudgetCategory, BudgetCategory.id == BudgetTransaction.category_id)
            .filter(
                BudgetTransaction.user_id == u.id,
                cast(BudgetTransaction.occurred_at, Date) >= d1,
                cast(BudgetTransaction.occurred_at, Date) <= d2,
            )
            .all()
        )
        income = 0.0
        expense = 0.0
        cat_expense: dict[str, float] = {}
        for tx, cat in txs:
            amt = _tx_amount(tx)
            if tx.type == TRANSACTION_TYPE_INCOME:
                income += amt
            elif tx.type == TRANSACTION_TYPE_EXPENSE:
                expense += amt
                cname = cat.name if cat else "Без категории"
                cat_expense[cname] = cat_expense.get(cname, 0) + amt

        top_cat = max(cat_expense, key=cat_expense.get) if cat_expense else None

        over_limit = 0
        categories = db.query(BudgetCategory).filter(
            BudgetCategory.user_id == u.id,
            BudgetCategory.kind == "expense",
            BudgetCategory.monthly_limit.isnot(None),
        ).all()
        for cat in categories:
            spent = cat_expense.get(cat.name, 0)
            if cat.monthly_limit and spent > float(cat.monthly_limit):
                over_limit += 1

        total_income += income
        total_expense += expense
        dashboard.append(
            BudgetUserDashboard(
                user_id=u.id,
                email=u.email,
                income=round(income, 2),
                expense=round(expense, 2),
                net=round(income - expense, 2),
                top_expense_category=top_cat,
                over_limit_categories=over_limit,
            )
        )

    return BudgetDashboardOut(
        year=y,
        month=m,
        users=dashboard,
        totals={"income": round(total_income, 2), "expense": round(total_expense, 2), "net": round(total_income - total_expense, 2)},
    )


@router.get("/budget/anomalies", response_model=List[BudgetAnomaly])
def budget_anomalies(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    threshold: float = Query(50000, description="Порог крупной траты"),
):
    today = date.today()
    d1, d2 = _month_range(today.year, today.month)
    prev_m = today.month - 1 if today.month > 1 else 12
    prev_y = today.year if today.month > 1 else today.year - 1
    pd1, pd2 = _month_range(prev_y, prev_m)

    anomalies: List[BudgetAnomaly] = []
    users = db.query(User).all()

    for u in users:
        txs = db.query(BudgetTransaction).filter(
            BudgetTransaction.user_id == u.id,
            cast(BudgetTransaction.occurred_at, Date) >= d1,
            cast(BudgetTransaction.occurred_at, Date) <= d2,
        ).all()
        if not txs:
            has_cats = db.query(BudgetCategory).filter(BudgetCategory.user_id == u.id).count()
            if has_cats:
                anomalies.append(BudgetAnomaly(user_id=u.id, email=u.email, kind="no_activity", message="Нет транзакций в текущем месяце"))

        for tx in txs:
            amt = _tx_amount(tx)
            if tx.type == TRANSACTION_TYPE_EXPENSE and amt >= threshold:
                anomalies.append(
                    BudgetAnomaly(
                        user_id=u.id, email=u.email, kind="large_expense",
                        message=f"Крупная трата: {tx.description or 'без описания'}",
                        amount=amt,
                    )
                )

        cur_exp = sum(_tx_amount(t) for t in txs if t.type == TRANSACTION_TYPE_EXPENSE)
        prev_txs = db.query(BudgetTransaction).filter(
            BudgetTransaction.user_id == u.id,
            cast(BudgetTransaction.occurred_at, Date) >= pd1,
            cast(BudgetTransaction.occurred_at, Date) <= pd2,
            BudgetTransaction.type == TRANSACTION_TYPE_EXPENSE,
        ).all()
        prev_exp = sum(_tx_amount(t) for t in prev_txs)
        if prev_exp > 0 and cur_exp > prev_exp * 1.5:
            anomalies.append(
                BudgetAnomaly(
                    user_id=u.id, email=u.email, kind="expense_spike",
                    message=f"Расходы выросли на {round((cur_exp / prev_exp - 1) * 100)}% к прошлому месяцу",
                    amount=cur_exp,
                )
            )

    return anomalies


@router.get("/budget/category-templates", response_model=List[CategoryTemplateOut])
def list_category_templates(admin: User = Depends(get_staff_user), db: Session = Depends(get_db)):
    return db.query(AdminCategoryTemplate).order_by(AdminCategoryTemplate.id).all()


@router.post("/budget/category-templates", response_model=CategoryTemplateOut)
def create_category_template(
    payload: CategoryTemplateIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    t = AdminCategoryTemplate(**payload.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    log_admin_action(db, admin, "create_category_template", details={"name": payload.name})
    return t


@router.put("/budget/category-templates/{template_id}", response_model=CategoryTemplateOut)
def update_category_template(
    template_id: int,
    payload: CategoryTemplateIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    t = db.get(AdminCategoryTemplate, template_id)
    if not t:
        raise HTTPException(HTTP_404_NOT_FOUND, "Шаблон не найден")
    for k, v in payload.model_dump().items():
        setattr(t, k, v)
    t.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(t)
    log_admin_action(db, admin, "update_category_template", details={"id": template_id})
    return t


@router.delete("/budget/category-templates/{template_id}")
def delete_category_template(
    template_id: int,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    t = db.get(AdminCategoryTemplate, template_id)
    if not t:
        raise HTTPException(HTTP_404_NOT_FOUND, "Шаблон не найден")
    db.delete(t)
    db.commit()
    log_admin_action(db, admin, "delete_category_template", details={"id": template_id})
    return {"status": "ok"}


@router.post("/budget/category-templates/apply/{user_id}")
def apply_category_templates_to_user(
    user_id: int,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    u = _user_or_404(db, user_id)
    templates = db.query(AdminCategoryTemplate).filter(AdminCategoryTemplate.apply_to_new_users == True).all()
    created = 0
    for t in templates:
        exists = db.query(BudgetCategory).filter(
            BudgetCategory.user_id == u.id,
            BudgetCategory.kind == t.kind,
            BudgetCategory.name == t.name,
        ).first()
        if exists:
            continue
        db.add(BudgetCategory(
            user_id=u.id,
            kind=t.kind,
            name=t.name,
            monthly_limit=t.monthly_limit,
            is_active=True,
        ))
        created += 1
    db.commit()
    log_admin_action(db, admin, "apply_category_templates", u.id, {"created": created})
    return {"created": created}


@router.get("/budget/transactions", response_model=List[AdminTransactionOut])
def admin_list_transactions(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    user_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
):
    q = db.query(BudgetTransaction, BudgetCategory, User).join(
        User, User.id == BudgetTransaction.user_id
    ).outerjoin(BudgetCategory, BudgetCategory.id == BudgetTransaction.category_id)

    if user_id:
        q = q.filter(BudgetTransaction.user_id == user_id)
    if from_date:
        q = q.filter(cast(BudgetTransaction.occurred_at, Date) >= date.fromisoformat(from_date))
    if to_date:
        q = q.filter(cast(BudgetTransaction.occurred_at, Date) <= date.fromisoformat(to_date))

    rows = q.order_by(BudgetTransaction.occurred_at.desc()).limit(limit).all()
    return [
        AdminTransactionOut(
            id=tx.id,
            user_id=user.id,
            email=user.email,
            type=tx.type,
            amount=_tx_amount(tx),
            currency=tx.currency,
            occurred_at=tx.occurred_at,
            category_name=cat.name if cat else None,
            description=tx.description,
        )
        for tx, cat, user in rows
    ]


@router.get("/budget/compare", response_model=BudgetCompareOut)
def budget_compare(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    user_a_id: int = Query(...),
    user_b_id: int = Query(...),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    d1, d2 = _month_range(y, m)

    def _summary(uid: int) -> dict:
        u = _user_or_404(db, uid)
        txs = db.query(BudgetTransaction).filter(
            BudgetTransaction.user_id == uid,
            cast(BudgetTransaction.occurred_at, Date) >= d1,
            cast(BudgetTransaction.occurred_at, Date) <= d2,
        ).all()
        income = sum(_tx_amount(t) for t in txs if t.type == TRANSACTION_TYPE_INCOME)
        expense = sum(_tx_amount(t) for t in txs if t.type == TRANSACTION_TYPE_EXPENSE)
        return {
            "user_id": uid,
            "email": u.email,
            "income": round(income, 2),
            "expense": round(expense, 2),
            "net": round(income - expense, 2),
            "transaction_count": len(txs),
        }

    return BudgetCompareOut(user_a=_summary(user_a_id), user_b=_summary(user_b_id))


@router.get("/budget/whiteboard-stats", response_model=List[WhiteboardStat])
def whiteboard_stats(admin: User = Depends(get_staff_user), db: Session = Depends(get_db)):
    users = db.query(User).all()
    out: List[WhiteboardStat] = []
    for u in users:
        boards = db.query(Whiteboard).filter(Whiteboard.user_id == u.id).all()
        last_upd = max((b.updated_at for b in boards if b.updated_at), default=None)
        out.append(WhiteboardStat(user_id=u.id, email=u.email, boards_count=len(boards), last_updated=last_upd))
    return out


@router.get("/budget/month-status", response_model=List[MonthStatusItem])
def month_status(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    d1, d2 = _month_range(y, m)

    users = db.query(User).all()
    out: List[MonthStatusItem] = []
    for u in users:
        txs = db.query(BudgetTransaction).filter(
            BudgetTransaction.user_id == u.id,
            cast(BudgetTransaction.occurred_at, Date) >= d1,
            cast(BudgetTransaction.occurred_at, Date) <= d2,
        ).all()
        income = sum(_tx_amount(t) for t in txs if t.type == TRANSACTION_TYPE_INCOME)
        expense = sum(_tx_amount(t) for t in txs if t.type == TRANSACTION_TYPE_EXPENSE)
        out.append(
            MonthStatusItem(
                user_id=u.id,
                email=u.email,
                has_activity=len(txs) > 0,
                transaction_count=len(txs),
                income=round(income, 2),
                expense=round(expense, 2),
            )
        )
    return out


# ===== OBLIGATIONS =====

@router.get("/obligations/summary", response_model=List[ObligationSummaryItem])
def obligations_summary(admin: User = Depends(get_staff_user), db: Session = Depends(get_db)):
    from app.backend.api.budget_obligation_blocks import _calc_metrics_exact

    blocks = (
        db.query(ObligationBlock, User)
        .join(User, User.id == ObligationBlock.user_id)
        .all()
    )
    out: List[ObligationSummaryItem] = []
    for block, user in blocks:
        db.refresh(block, ["payments"])
        metrics = _calc_metrics_exact(block)
        out.append(
            ObligationSummaryItem(
                user_id=user.id,
                email=user.email,
                block_id=block.id,
                title=block.title or "",
                monthly=float(block.monthly or 0),
                remaining=metrics.get("remaining", 0),
                status=block.status or "active",
                next_payment=block.next_payment,
            )
        )
    return out


@router.get("/obligations/calendar", response_model=List[CalendarPayment])
def obligations_calendar(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    d1, d2 = _month_range(y, m)

    out: List[CalendarPayment] = []

    blocks = db.query(ObligationBlock, User).join(User, User.id == ObligationBlock.user_id).all()
    for block, user in blocks:
        if block.next_payment and d1 <= block.next_payment <= d2:
            out.append(
                CalendarPayment(
                    user_id=user.id,
                    email=user.email,
                    date=block.next_payment,
                    title=block.title or "",
                    amount=float(block.monthly or 0),
                    kind="block",
                )
            )
        payments = db.query(ObligationPayment).filter(ObligationPayment.obligation_id == block.id).all()
        for p in payments:
            if p.date and d1 <= p.date <= d2 and not p.ok:
                out.append(
                    CalendarPayment(
                        user_id=user.id,
                        email=user.email,
                        date=p.date,
                        title=f"{block.title} (#{p.n})",
                        amount=float(p.amount or 0),
                        kind="block",
                    )
                )

    simple = db.query(BudgetObligation, User).join(User, User.id == BudgetObligation.user_id).filter(
        BudgetObligation.is_done == False,
        BudgetObligation.due_date >= d1,
        BudgetObligation.due_date <= d2,
    ).all()
    for obl, user in simple:
        out.append(
            CalendarPayment(
                user_id=user.id,
                email=user.email,
                date=obl.due_date,
                title=obl.title,
                amount=float(obl.amount or 0),
                kind="simple",
            )
        )

    out.sort(key=lambda x: x.date)
    return out


@router.get("/obligations/risks", response_model=List[ObligationRisk])
def obligations_risks(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    soon = today + timedelta(days=3)
    risks: List[ObligationRisk] = []

    blocks = db.query(ObligationBlock, User).join(User, User.id == ObligationBlock.user_id).all()
    for block, user in blocks:
        if block.next_payment and block.next_payment < today:
            risks.append(
                ObligationRisk(
                    user_id=user.id, email=user.email, kind="overdue",
                    title=block.title or "", message="Просрочен платёж по блоку",
                    amount=float(block.monthly or 0), due_date=block.next_payment,
                )
            )
        elif block.next_payment and block.next_payment <= soon:
            risks.append(
                ObligationRisk(
                    user_id=user.id, email=user.email, kind="upcoming",
                    title=block.title or "", message="Платёж через 3 дня или меньше",
                    amount=float(block.monthly or 0), due_date=block.next_payment,
                )
            )

    overdue_simple = db.query(BudgetObligation, User).join(User, User.id == BudgetObligation.user_id).filter(
        BudgetObligation.is_done == False,
        BudgetObligation.due_date < today,
    ).all()
    for obl, user in overdue_simple:
        risks.append(
            ObligationRisk(
                user_id=user.id, email=user.email, kind="overdue_simple",
                title=obl.title, message="Просроченное простое обязательство",
                amount=float(obl.amount or 0), due_date=obl.due_date,
            )
        )

    return risks


@router.get("/obligations/templates", response_model=List[ObligationTemplateOut])
def list_obligation_templates(admin: User = Depends(get_staff_user), db: Session = Depends(get_db)):
    return db.query(AdminObligationTemplate).order_by(AdminObligationTemplate.id).all()


@router.post("/obligations/templates", response_model=ObligationTemplateOut)
def create_obligation_template(
    payload: ObligationTemplateIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    t = AdminObligationTemplate(**payload.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    log_admin_action(db, admin, "create_obligation_template", details={"title": payload.title})
    return t


@router.put("/obligations/templates/{template_id}", response_model=ObligationTemplateOut)
def update_obligation_template(
    template_id: int,
    payload: ObligationTemplateIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    t = db.get(AdminObligationTemplate, template_id)
    if not t:
        raise HTTPException(HTTP_404_NOT_FOUND, "Шаблон не найден")
    for k, v in payload.model_dump().items():
        setattr(t, k, v)
    t.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/obligations/templates/{template_id}")
def delete_obligation_template(
    template_id: int,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    t = db.get(AdminObligationTemplate, template_id)
    if not t:
        raise HTTPException(HTTP_404_NOT_FOUND, "Шаблон не найден")
    db.delete(t)
    db.commit()
    return {"status": "ok"}


@router.post("/obligations/templates/{template_id}/apply/{user_id}")
def apply_obligation_template(
    template_id: int,
    user_id: int,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    t = db.get(AdminObligationTemplate, template_id)
    if not t:
        raise HTTPException(HTTP_404_NOT_FOUND, "Шаблон не найден")
    u = _user_or_404(db, user_id)
    block = ObligationBlock(
        user_id=u.id,
        title=t.title,
        total=float(t.total or 0),
        monthly=float(t.monthly or 0),
        rate=float(t.rate or 0),
        due_day=t.due_day,
        notes=t.notes or "",
        status="Активный",
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    log_admin_action(db, admin, "apply_obligation_template", u.id, {"template_id": template_id, "block_id": block.id})
    return {"block_id": block.id}


# ===== USERS =====

@router.get("/users/{user_id}/detail", response_model=UserDetailOut)
def user_detail(
    user_id: int,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    u = _user_or_404(db, user_id)
    pf_ids = [p.id for p in db.query(Portfolio).filter(Portfolio.user_id == u.id).all()]
    positions_count = db.query(Position).filter(Position.portfolio_id.in_(pf_ids)).count() if pf_ids else 0
    return UserDetailOut(
        id=u.id,
        email=u.email,
        tg_username=u.tg_username,
        is_staff=u.is_staff,
        has_tinkoff=u.has_tinkoff_token,
        created_at=u.created_at or datetime.now(timezone.utc),
        last_login_at=u.last_login_at,
        portfolios_count=len(pf_ids),
        positions_count=positions_count,
        transactions_count=db.query(BudgetTransaction).filter(BudgetTransaction.user_id == u.id).count(),
        whiteboards_count=db.query(Whiteboard).filter(Whiteboard.user_id == u.id).count(),
        obligation_blocks_count=db.query(ObligationBlock).filter(ObligationBlock.user_id == u.id).count(),
        categories_count=db.query(BudgetCategory).filter(BudgetCategory.user_id == u.id).count(),
    )


@router.post("/users/{user_id}/impersonate", response_model=ImpersonateOut)
def impersonate_user(
    user_id: int,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    target = _user_or_404(db, user_id)
    if target.id == admin.id:
        raise HTTPException(400, "Нельзя impersonate самого себя")
    token = create_impersonation_token(target.id, admin.id, expires_minutes=60)
    log_admin_action(db, admin, "impersonate", target.id)
    return ImpersonateOut(
        access_token=token,
        user_id=target.id,
        email=target.email,
        tg_username=target.tg_username,
        impersonated_by=admin.id,
    )


@router.get("/audit-log", response_model=List[AuditLogItem])
def audit_log(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, le=200),
):
    rows = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit).all()
    admin_map = {u.id: u.email for u in db.query(User).all()}
    target_ids = {r.target_user_id for r in rows if r.target_user_id}
    target_map = {}
    if target_ids:
        target_map = {u.id: u.email for u in db.query(User).filter(User.id.in_(target_ids)).all()}

    return [
        AuditLogItem(
            id=r.id,
            admin_id=r.admin_id,
            admin_email=admin_map.get(r.admin_id, "?"),
            action=r.action,
            target_user_id=r.target_user_id,
            target_email=target_map.get(r.target_user_id) if r.target_user_id else None,
            details=r.details,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/users/bulk-export")
def bulk_export_users(
    payload: BulkExportIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if payload.user_ids:
        q = q.filter(User.id.in_(payload.user_ids))
    users = q.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "email", "tg_username", "is_staff", "has_tinkoff", "created_at", "last_login_at",
                     "portfolios", "transactions", "whiteboards", "obligation_blocks"])
    for u in users:
        writer.writerow([
            u.id, u.email, u.tg_username or "", u.is_staff, u.has_tinkoff_token,
            u.created_at.isoformat() if u.created_at else "",
            u.last_login_at.isoformat() if u.last_login_at else "",
            db.query(Portfolio).filter(Portfolio.user_id == u.id).count(),
            db.query(BudgetTransaction).filter(BudgetTransaction.user_id == u.id).count(),
            db.query(Whiteboard).filter(Whiteboard.user_id == u.id).count(),
            db.query(ObligationBlock).filter(ObligationBlock.user_id == u.id).count(),
        ])
    log_admin_action(db, admin, "bulk_export_users", details={"count": len(users)})
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_export.csv"},
    )
