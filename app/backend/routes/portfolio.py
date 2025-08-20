from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload

from app.backend.core.auth import get_current_user
from app.backend.db.session import get_db
from app.backend.models.portfolio import Portfolio, Position
from app.backend.models.instrument import Instrument

router = APIRouter()

# ===== Schemas (вход) =====
class PortfolioCreateIn(BaseModel):
    title: str = "Основной"
    type: str = "broker"
    currency: str = "RUB"


class PositionUpsertIn(BaseModel):
    portfolio_id: int
    figi: str
    ticker: Optional[str] = None
    class_hint: Optional[str] = None
    quantity: float
    avg_price: float
    name: Optional[str] = None
    currency: Optional[str] = None
    nominal: Optional[float] = None


# ===== Helpers =====
def _ensure_portfolio_of_user(db: Session, portfolio_id: int, user_id: int) -> Portfolio:
    pf = db.get(Portfolio, portfolio_id)
    if not pf or pf.user_id != user_id:
        raise HTTPException(status_code=404, detail="Портфель не найден")
    return pf


def _pf_to_dict(pf: Portfolio) -> dict:
    return {
        "id": pf.id,
        "title": pf.title,
        "type": pf.type,
        "currency": pf.currency,
        "user_id": pf.user_id,
        "created_at": pf.created_at.isoformat() if getattr(pf, "created_at", None) else None,
        "updated_at": pf.updated_at.isoformat() if getattr(pf, "updated_at", None) else None,
    }


# ===== Endpoints =====

# ВАЖНО: не используем SQLAlchemy модели как тип возврата/response_model
@router.get("/portfolio", response_model=None)
def list_portfolios(user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            select(Portfolio)
            .where(Portfolio.user_id == user.id)
            .order_by(Portfolio.id.asc())
        )
        .scalars()
        .all()
    )
    return [_pf_to_dict(p) for p in rows]


@router.post("/portfolio", response_model=None)
def create_portfolio(
    payload: PortfolioCreateIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pf = Portfolio(
        title=payload.title,
        type=payload.type,
        currency=payload.currency,
        user_id=user.id,
    )
    db.add(pf)
    db.commit()
    db.refresh(pf)
    return _pf_to_dict(pf)


@router.get("/portfolio/{portfolio_id}/positions/full", response_model=None)
def list_positions_full(
    portfolio_id: int = Path(..., ge=1),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_portfolio_of_user(db, portfolio_id, user.id)

    # positions + instrument
    rows: List[Position] = (
        db.execute(
            select(Position)
            .options(joinedload(Position.instrument))
            .where(Position.portfolio_id == portfolio_id)
            .order_by(Position.id.asc())
        )
        .scalars()
        .all()
    )

    out = []
    for p in rows:
        inst = p.instrument
        out.append(
            {
                "id": p.id,
                "portfolio_id": p.portfolio_id,
                "figi": p.figi,
                "quantity": float(p.quantity or 0),
                "avg_price": float(p.avg_price or 0),
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                "instrument": {
                    "figi": inst.figi if inst else p.figi,
                    "ticker": (inst.ticker if inst else None) or None,
                    "name": inst.name if inst else None,
                    # в JSON ключ будет "class", даже если в модели поле называется class_
                    "class": getattr(inst, "class_", None)
                    or getattr(inst, "class", None)
                    or "other",
                    "currency": inst.currency if inst else None,
                    "nominal": inst.nominal if inst else None,
                },
            }
        )
    return out


@router.delete("/portfolio/positions/{position_id}", response_model=None)
def delete_position(
    position_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pos = db.get(Position, position_id)
    if not pos:
        raise HTTPException(404, "Позиция не найдена")
    _ensure_portfolio_of_user(db, pos.portfolio_id, user.id)
    db.delete(pos)
    db.commit()
    return {"ok": True}


@router.post("/portfolio/positions", response_model=None)
def upsert_position(
    payload: PositionUpsertIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # право пользователя
    _ensure_portfolio_of_user(db, payload.portfolio_id, user.id)

    # гарантируем инструмент
    inst = db.get(Instrument, payload.figi)
    if not inst:
        inst = Instrument(
            figi=payload.figi,
            ticker=(payload.ticker or "").upper() or None,
            class_=payload.class_hint or "other",
            name=payload.name,
            currency=payload.currency,
            nominal=payload.nominal,
        )
        db.add(inst)
        db.flush()

    # аддитивный UPSERT по (portfolio_id, figi)
    stmt = insert(Position).values(
        portfolio_id=payload.portfolio_id,
        figi=payload.figi,
        quantity=payload.quantity,
        avg_price=payload.avg_price,
        updated_at=datetime.utcnow(),
    )

    q_sum = Position.quantity + stmt.excluded.quantity
    weighted_avg = (
        (Position.avg_price * Position.quantity + stmt.excluded.avg_price * stmt.excluded.quantity)
        / func.nullif(q_sum, 0)
    )

    stmt = (
        stmt.on_conflict_do_update(
            index_elements=[Position.portfolio_id, Position.figi],
            set_={
                "quantity": q_sum,
                "avg_price": func.coalesce(weighted_avg, stmt.excluded.avg_price),
                "updated_at": datetime.utcnow(),
            },
        )
        .returning(Position.id)
    )

    new_id = db.execute(stmt).scalar_one()
    db.commit()
    # фронту отдаем только id – ему этого достаточно
    return {"id": int(new_id)}
