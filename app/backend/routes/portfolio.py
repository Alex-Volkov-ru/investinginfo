from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.db.session import get_db
from app.backend.models.portfolio import Portfolio, Position
from app.backend.models.instrument import Instrument

router = APIRouter()

# ====== Schemas ======

class PortfolioCreateIn(BaseModel):
    title: str
    type: str = "broker"
    currency: str = "RUB"
    # примем user_id для совместимости, но игнорируем
    user_id: int | None = None

class PortfolioOut(BaseModel):
    id: int
    user_id: int
    title: str
    type: str
    currency: str
    class Config:
        from_attributes = True

class InstrumentShort(BaseModel):
    ticker: str | None = None
    name: str | None = None
    class_: str | None = Field(None, alias="class")
    currency: str | None = None
    nominal: float | None = None
    class Config:
        populate_by_name = True
        from_attributes = True

class PositionUpsertIn(BaseModel):
    portfolio_id: int
    ticker: str = Field(..., description="Например, SBER")
    class_hint: str | None = Field(None, description="share|bond|etf (опционально)")
    figi: str | None = Field(None, description="Если известен FIGI — можно указать")
    quantity: float = 0
    avg_price: float = 0
    name: str | None = None
    currency: str | None = None
    nominal: float | None = None  # для bond

class PositionOut(BaseModel):
    id: int
    portfolio_id: int
    figi: str
    quantity: float
    avg_price: float
    class Config:
        from_attributes = True

class PositionFullOut(PositionOut):
    instrument: InstrumentShort

# ====== Helpers ======

def _ensure_portfolio_of_user(db: Session, portfolio_id: int, user_id: int) -> Portfolio:
    pf = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user_id).first()
    if not pf:
        raise HTTPException(403, "Нет доступа к этому портфелю")
    return pf

# ====== Endpoints ======

@router.get("", response_model=list[PortfolioOut])
def list_portfolios(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Portfolio).filter(Portfolio.user_id == user.id).all()

@router.post("", response_model=PortfolioOut)
def create_portfolio(payload: PortfolioCreateIn, user=Depends(get_current_user), db: Session = Depends(get_db)):
    p = Portfolio(
        user_id=user.id,
        title=payload.title,
        type=payload.type,
        currency=payload.currency,
        created_at=datetime.utcnow(),
    )
    db.add(p); db.commit(); db.refresh(p)
    return p

@router.get("/{portfolio_id}/positions", response_model=list[PositionOut])
def list_positions(portfolio_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_portfolio_of_user(db, portfolio_id, user.id)
    return db.query(Position).filter(Position.portfolio_id == portfolio_id).all()

@router.get("/{portfolio_id}/positions/full", response_model=list[PositionFullOut])
def list_positions_full(portfolio_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_portfolio_of_user(db, portfolio_id, user.id)
    rows = (
        db.query(Position, Instrument)
        .join(Instrument, Instrument.figi == Position.figi, isouter=True)
        .filter(Position.portfolio_id == portfolio_id)
        .all()
    )
    out: list[PositionFullOut] = []
    for pos, inst in rows:
        instrument = None
        if inst:
            instrument = InstrumentShort(
                ticker=inst.ticker, name=inst.name, class_=inst.class_,
                currency=inst.currency, nominal=float(inst.nominal) if inst.nominal is not None else None
            )
        out.append(PositionFullOut(
            id=pos.id,
            portfolio_id=pos.portfolio_id,
            figi=pos.figi,
            quantity=float(pos.quantity),
            avg_price=float(pos.avg_price),
            instrument=instrument or InstrumentShort()
        ))
    return out

@router.post("/positions", response_model=PositionOut)
def upsert_position(payload: PositionUpsertIn, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_portfolio_of_user(db, payload.portfolio_id, user.id)

    figi = (payload.figi or "").strip()
    if not figi:
        raise HTTPException(400, "Требуется figi (разрешай тикер через /resolve)")

    # гарантируем, что инструмент существует в каталоге
    inst = db.get(Instrument, figi)
    if not inst:
        inst = Instrument(
            figi=figi,
            ticker=(payload.ticker or "").upper() or None,
            name=payload.name,
            currency=payload.currency,
            nominal=payload.nominal,
            class_=payload.class_hint or "other",
        )
        db.add(inst)

    pos = (
        db.query(Position)
        .filter(Position.portfolio_id == payload.portfolio_id, Position.figi == figi)
        .first()
    )
    if not pos:
        pos = Position(
            portfolio_id=payload.portfolio_id,
            figi=figi,
            quantity=payload.quantity,
            avg_price=payload.avg_price,
            updated_at=datetime.utcnow(),
        )
        db.add(pos)
    else:
        pos.quantity = payload.quantity
        pos.avg_price = payload.avg_price
        pos.updated_at = datetime.utcnow()

    db.commit(); db.refresh(pos)
    return pos

@router.delete("/positions/{position_id}", status_code=204)
def delete_position(position_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    pos = db.get(Position, position_id)
    if not pos:
        raise HTTPException(404, "Позиция не найдена")
    _ensure_portfolio_of_user(db, pos.portfolio_id, user.id)
    db.delete(pos); db.commit()
    return
