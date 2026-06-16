"""Дополнительные эндпоинты админ-панели (фичи по вкладкам)."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import cast, func, or_
from sqlalchemy.types import Date
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.backend.core.auth import get_staff_user
from app.backend.core.config import get_settings
from app.backend.core.constants import (
    ERROR_USER_NOT_FOUND,
    HTTP_404_NOT_FOUND,
    TRANSACTION_TYPE_EXPENSE,
    TRANSACTION_TYPE_INCOME,
)
from app.backend.core.security import decrypt_token
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.portfolio import Portfolio, Position
from app.backend.models.instrument import Instrument
from app.backend.models.budget import BudgetTransaction, BudgetCategory, BudgetObligation, ObligationBlock, ObligationPayment
from app.backend.models.admin import AdminObligationRiskDismissal
from app.backend.models.whiteboard import Whiteboard
from app.backend.routes.market import _get_last_prices_blocking, settings as market_settings
from app.backend.services.admin_audit import log_admin_action

router = APIRouter(prefix="/admin", tags=["admin"])


def _tx_amount(tx: BudgetTransaction) -> float:
    from app.backend.core.security import decrypt_amount

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


def _resolve_tinkoff_token(db: Session) -> str | None:
    token = market_settings.TINKOFF_TOKEN
    if token:
        return token
    admin_user = db.query(User).filter(User.tinkoff_token_enc.isnot(None)).first()
    if admin_user:
        token = decrypt_token(admin_user.tinkoff_token_enc or "")
        if token:
            return token
    return None


# ── Users ──

class UserActivityOut(BaseModel):
    user_id: int
    registered_at: datetime
    last_login_at: Optional[datetime] = None
    last_transaction_at: Optional[datetime] = None
    last_position_update: Optional[datetime] = None
    last_whiteboard_update: Optional[datetime] = None


@router.get("/users/{user_id}/activity", response_model=UserActivityOut)
def user_activity(
    user_id: int,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    u = _user_or_404(db, user_id)
    pf_ids = [p.id for p in db.query(Portfolio.id).filter(Portfolio.user_id == u.id).all()]

    last_tx = (
        db.query(func.max(BudgetTransaction.occurred_at))
        .filter(BudgetTransaction.user_id == u.id)
        .scalar()
    )
    last_pos = None
    if pf_ids:
        last_pos = (
            db.query(func.max(Position.updated_at))
            .filter(Position.portfolio_id.in_(pf_ids))
            .scalar()
        )
    last_wb = (
        db.query(func.max(Whiteboard.updated_at))
        .filter(Whiteboard.user_id == u.id)
        .scalar()
    )

    return UserActivityOut(
        user_id=u.id,
        registered_at=u.created_at or datetime.now(timezone.utc),
        last_login_at=u.last_login_at,
        last_transaction_at=last_tx,
        last_position_update=last_pos,
        last_whiteboard_update=last_wb,
    )


# ── Budget ──

class OverLimitItem(BaseModel):
    user_id: int
    email: str
    category_name: str
    monthly_limit: float
    spent: float
    over_by: float
    over_pct: float


@router.get("/budget/over-limits", response_model=List[OverLimitItem])
def budget_over_limits(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    today = date.today()
    y, m = year or today.year, month or today.month
    d1, d2 = _month_range(y, m)
    out: List[OverLimitItem] = []

    users = db.query(User).all()
    for u in users:
        txs = (
            db.query(BudgetTransaction, BudgetCategory)
            .outerjoin(BudgetCategory, BudgetCategory.id == BudgetTransaction.category_id)
            .filter(
                BudgetTransaction.user_id == u.id,
                BudgetTransaction.type == TRANSACTION_TYPE_EXPENSE,
                cast(BudgetTransaction.occurred_at, Date) >= d1,
                cast(BudgetTransaction.occurred_at, Date) <= d2,
            )
            .all()
        )
        spent_by_cat: dict[int, tuple[str, float]] = {}
        for tx, cat in txs:
            if not cat:
                continue
            cid = cat.id
            name = cat.name
            spent_by_cat[cid] = (name, spent_by_cat.get(cid, (name, 0))[1] + _tx_amount(tx))

        categories = db.query(BudgetCategory).filter(
            BudgetCategory.user_id == u.id,
            BudgetCategory.kind == "expense",
            BudgetCategory.monthly_limit.isnot(None),
        ).all()
        for cat in categories:
            limit = float(cat.monthly_limit or 0)
            if limit <= 0:
                continue
            spent = spent_by_cat.get(cat.id, (cat.name, 0))[1]
            if spent > limit:
                over_by = spent - limit
                out.append(
                    OverLimitItem(
                        user_id=u.id,
                        email=u.email,
                        category_name=cat.name,
                        monthly_limit=round(limit, 2),
                        spent=round(spent, 2),
                        over_by=round(over_by, 2),
                        over_pct=round(over_by / limit * 100, 1),
                    )
                )

    out.sort(key=lambda x: -x.over_pct)
    return out


# Extend transactions search — registered via duplicate route with search param in admin.py patch


# ── Obligations ──

class CalendarDayStat(BaseModel):
    day: int
    payment_count: int
    total_amount: float


class CalendarHeatmapOut(BaseModel):
    year: int
    month: int
    days: List[CalendarDayStat]
    forecast_7d: float
    forecast_30d: float
    overdue_count: int
    upcoming_count: int


class ObligationRiskItem(BaseModel):
    user_id: int
    email: str
    kind: str
    severity: str  # overdue | today | soon | upcoming
    title: str
    message: str
    amount: float
    due_date: Optional[date] = None
    days_until: Optional[int] = None
    block_id: Optional[int] = None
    obligation_id: Optional[int] = None


class RiskDismissIn(BaseModel):
    user_id: int
    kind: str
    block_id: Optional[int] = None
    obligation_id: Optional[int] = None


def _risk_is_dismissed(db: Session, item: ObligationRiskItem) -> bool:
    q = db.query(AdminObligationRiskDismissal).filter(
        AdminObligationRiskDismissal.user_id == item.user_id,
        AdminObligationRiskDismissal.kind == item.kind,
    )
    if item.block_id is not None:
        q = q.filter(AdminObligationRiskDismissal.block_id == item.block_id)
    elif item.obligation_id is not None:
        q = q.filter(AdminObligationRiskDismissal.obligation_id == item.obligation_id)
    else:
        return False
    return q.first() is not None


@router.get("/obligations/calendar-heatmap", response_model=CalendarHeatmapOut)
def obligations_calendar_heatmap(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    today = date.today()
    y, m = year or today.year, month or today.month
    d1, d2 = _month_range(y, m)
    day_stats: dict[int, dict] = {}

    def add_payment(pay_date: date, amount: float) -> None:
        if not (d1 <= pay_date <= d2):
            return
        day = pay_date.day
        if day not in day_stats:
            day_stats[day] = {"count": 0, "total": 0.0}
        day_stats[day]["count"] += 1
        day_stats[day]["total"] += amount

    blocks = db.query(ObligationBlock, User).join(User, User.id == ObligationBlock.user_id).all()
    for block, _user in blocks:
        if block.next_payment and d1 <= block.next_payment <= d2:
            add_payment(block.next_payment, float(block.monthly or 0))

    simple = db.query(BudgetObligation).filter(
        BudgetObligation.is_done == False,
        BudgetObligation.due_date >= d1,
        BudgetObligation.due_date <= d2,
    ).all()
    for obl in simple:
        add_payment(obl.due_date, float(obl.amount or 0))

    forecast_7d = 0.0
    forecast_30d = 0.0
    f7 = today + timedelta(days=7)
    f30 = today + timedelta(days=30)
    for block, _ in blocks:
        if block.next_payment and today <= block.next_payment <= f7:
            forecast_7d += float(block.monthly or 0)
        if block.next_payment and today <= block.next_payment <= f30:
            forecast_30d += float(block.monthly or 0)
    for obl in db.query(BudgetObligation).filter(BudgetObligation.is_done == False).all():
        if obl.due_date and today <= obl.due_date <= f7:
            forecast_7d += float(obl.amount or 0)
        if obl.due_date and today <= obl.due_date <= f30:
            forecast_30d += float(obl.amount or 0)

    overdue = 0
    upcoming = 0
    soon = today + timedelta(days=3)
    for block, _ in blocks:
        if block.next_payment:
            if block.next_payment < today:
                overdue += 1
            elif block.next_payment <= soon:
                upcoming += 1

    _, last_day = calendar.monthrange(y, m)
    return CalendarHeatmapOut(
        year=y,
        month=m,
        days=[
            CalendarDayStat(
                day=day,
                payment_count=day_stats.get(day, {}).get("count", 0),
                total_amount=round(day_stats.get(day, {}).get("total", 0.0), 2),
            )
            for day in range(1, last_day + 1)
        ],
        forecast_7d=round(forecast_7d, 2),
        forecast_30d=round(forecast_30d, 2),
        overdue_count=overdue,
        upcoming_count=upcoming,
    )


@router.get("/obligations/risks-detailed", response_model=List[ObligationRiskItem])
def obligations_risks_detailed(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    soon = today + timedelta(days=3)
    week = today + timedelta(days=7)
    items: List[ObligationRiskItem] = []

    blocks = db.query(ObligationBlock, User).join(User, User.id == ObligationBlock.user_id).all()
    for block, user in blocks:
        if not block.next_payment:
            continue
        nd = (block.next_payment - today).days
        amt = float(block.monthly or 0)
        if block.next_payment < today:
            items.append(ObligationRiskItem(
                user_id=user.id, email=user.email, kind="block", severity="overdue",
                title=block.title or "", message="Просрочен платёж",
                amount=amt, due_date=block.next_payment, days_until=nd,
                block_id=block.id,
            ))
        elif block.next_payment == today:
            items.append(ObligationRiskItem(
                user_id=user.id, email=user.email, kind="block", severity="today",
                title=block.title or "", message="Платёж сегодня",
                amount=amt, due_date=block.next_payment, days_until=0,
                block_id=block.id,
            ))
        elif block.next_payment <= soon:
            items.append(ObligationRiskItem(
                user_id=user.id, email=user.email, kind="block", severity="soon",
                title=block.title or "", message="Платёж в ближайшие 3 дня",
                amount=amt, due_date=block.next_payment, days_until=nd,
                block_id=block.id,
            ))
        elif block.next_payment <= week:
            items.append(ObligationRiskItem(
                user_id=user.id, email=user.email, kind="block", severity="upcoming",
                title=block.title or "", message="Платёж на этой неделе",
                amount=amt, due_date=block.next_payment, days_until=nd,
                block_id=block.id,
            ))

    for obl, user in (
        db.query(BudgetObligation, User)
        .join(User, User.id == BudgetObligation.user_id)
        .filter(BudgetObligation.is_done == False)
        .all()
    ):
        if not obl.due_date:
            continue
        nd = (obl.due_date - today).days
        amt = float(obl.amount or 0)
        if obl.due_date < today:
            sev = "overdue"
            msg = "Просрочено"
        elif obl.due_date == today:
            sev, msg = "today", "Сегодня"
        elif obl.due_date <= soon:
            sev, msg = "soon", "В ближайшие 3 дня"
        elif obl.due_date <= week:
            sev, msg = "upcoming", "На этой неделе"
        else:
            continue
        items.append(ObligationRiskItem(
            user_id=user.id, email=user.email, kind="simple", severity=sev,
            title=obl.title, message=msg, amount=amt, due_date=obl.due_date, days_until=nd,
            obligation_id=obl.id,
        ))

    order = {"overdue": 0, "today": 1, "soon": 2, "upcoming": 3}
    items.sort(key=lambda x: (order.get(x.severity, 9), x.days_until or 99))
    return [item for item in items if not _risk_is_dismissed(db, item)]


@router.post("/obligations/risks/dismiss")
def dismiss_obligation_risk(
    payload: RiskDismissIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    if payload.kind == "block" and not payload.block_id:
        raise HTTPException(HTTP_404_NOT_FOUND, "block_id обязателен")
    if payload.kind == "simple" and not payload.obligation_id:
        raise HTTPException(HTTP_404_NOT_FOUND, "obligation_id обязателен")

    q = db.query(AdminObligationRiskDismissal).filter(
        AdminObligationRiskDismissal.user_id == payload.user_id,
        AdminObligationRiskDismissal.kind == payload.kind,
    )
    if payload.block_id is not None:
        q = q.filter(AdminObligationRiskDismissal.block_id == payload.block_id)
    if payload.obligation_id is not None:
        q = q.filter(AdminObligationRiskDismissal.obligation_id == payload.obligation_id)

    if not q.first():
        db.add(
            AdminObligationRiskDismissal(
                user_id=payload.user_id,
                kind=payload.kind,
                block_id=payload.block_id,
                obligation_id=payload.obligation_id,
                dismissed_by=admin.id,
            )
        )
        db.commit()
        log_admin_action(
            db,
            admin,
            "dismiss_obligation_risk",
            payload.user_id,
            payload.model_dump(),
        )
    return {"status": "ok"}


# ── Investments ──

class PortfolioMarketRow(BaseModel):
    user_id: int
    email: str
    avg_value: float
    market_value: Optional[float] = None
    delta_pct: Optional[float] = None
    positions_count: int


class PortfolioMarketOut(BaseModel):
    rows: List[PortfolioMarketRow]
    tinkoff_available: bool
    message: Optional[str] = None


class InvestmentAlert(BaseModel):
    user_id: int
    email: str
    kind: str
    message: str
    severity: str  # warn | info


@router.get("/investments/market-overview", response_model=PortfolioMarketOut)
async def investments_market_overview(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    token = _resolve_tinkoff_token(db)
    figi_prices: dict[str, float] = {}

    if token:
        figis = [r[0] for r in db.query(Position.figi).distinct().all() if r[0]]
        batch_size = 50
        for i in range(0, len(figis), batch_size):
            batch = figis[i : i + batch_size]
            try:
                prices = await run_in_threadpool(_get_last_prices_blocking, batch, token)
                figi_prices.update(prices)
            except Exception:
                pass

    rows: List[PortfolioMarketRow] = []
    users = db.query(User).all()
    for u in users:
        pf_ids = [p.id for p in db.query(Portfolio).filter(Portfolio.user_id == u.id).all()]
        avg_value = 0.0
        market_value = 0.0
        pos_count = 0
        has_prices = False
        if pf_ids:
            positions = db.query(Position).filter(Position.portfolio_id.in_(pf_ids)).all()
            pos_count = len(positions)
            for pos in positions:
                qty = float(pos.quantity or 0)
                avg = float(pos.avg_price or 0)
                avg_value += qty * avg
                if pos.figi and pos.figi in figi_prices:
                    market_value += qty * figi_prices[pos.figi]
                    has_prices = True
                elif token and pos.figi:
                    market_value += qty * avg
                else:
                    market_value += qty * avg

        delta_pct = None
        mkt = None
        if has_prices and avg_value > 0:
            mkt = round(market_value, 2)
            delta_pct = round((market_value / avg_value - 1) * 100, 1)

        rows.append(
            PortfolioMarketRow(
                user_id=u.id,
                email=u.email,
                avg_value=round(avg_value, 2),
                market_value=mkt,
                delta_pct=delta_pct,
                positions_count=pos_count,
            )
        )

    return PortfolioMarketOut(
        rows=rows,
        tinkoff_available=bool(token and figi_prices),
        message=None if token else "Нет Tinkoff-токена — показана только стоимость по avg",
    )


@router.get("/investments/alerts", response_model=List[InvestmentAlert])
def investments_alerts(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    alerts: List[InvestmentAlert] = []
    users = db.query(User).all()

    for u in users:
        pf_ids = [p.id for p in db.query(Portfolio).filter(Portfolio.user_id == u.id).all()]
        pos_count = db.query(Position).filter(Position.portfolio_id.in_(pf_ids)).count() if pf_ids else 0

        if u.has_tinkoff_token and pos_count == 0:
            alerts.append(InvestmentAlert(
                user_id=u.id, email=u.email, kind="empty_portfolio",
                message="Tinkoff подключён, но позиций нет", severity="info",
            ))

        if pf_ids:
            rows = (
                db.query(Position, Instrument)
                .outerjoin(Instrument, Instrument.figi == Position.figi)
                .filter(Position.portfolio_id.in_(pf_ids))
                .all()
            )
            by_class: dict[str, float] = {}
            total = 0.0
            for pos, inst in rows:
                val = float(pos.quantity or 0) * float(pos.avg_price or 0)
                cls = (inst.class_ if inst and inst.class_ else "unknown") or "unknown"
                by_class[cls] = by_class.get(cls, 0) + val
                total += val
            if total > 0 and len(by_class) > 1:
                top_cls = max(by_class, key=by_class.get)
                pct = by_class[top_cls] / total * 100
                if pct >= 50:
                    alerts.append(InvestmentAlert(
                        user_id=u.id, email=u.email, kind="concentration",
                        message=f"Концентрация {pct:.0f}% ({top_cls})", severity="warn",
                    ))

        missing_figi = 0
        if pf_ids:
            missing_figi = db.query(Position).filter(
                Position.portfolio_id.in_(pf_ids),
                or_(Position.figi.is_(None), Position.figi == ""),
            ).count()
        if missing_figi:
            alerts.append(InvestmentAlert(
                user_id=u.id, email=u.email, kind="missing_figi",
                message=f"{missing_figi} поз. без FIGI", severity="warn",
            ))

    return alerts
