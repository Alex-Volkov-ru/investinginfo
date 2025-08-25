from __future__ import annotations

from typing import List, Optional, Annotated
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pydantic.types import StringConstraints
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.backend.db.session import get_db
from app.backend.core.auth import get_current_user
from app.backend.models.user import User
from app.backend.models.budget import BudgetObligation

router = APIRouter(prefix="/budget/obligations", tags=["budget: obligations"])

# ---- string constraint aliases (pydantic v2 way)
TitleStr = Annotated[str, StringConstraints(min_length=1)]
Currency3 = Annotated[str, StringConstraints(min_length=3, max_length=3)]


# ===== Schemas =====
class ObligationCreateIn(BaseModel):
    title: TitleStr
    due_date: date
    amount: float = Field(ge=0)
    currency: Currency3 = "RUB"


class ObligationUpdateIn(BaseModel):
    title: Optional[TitleStr] = None
    due_date: Optional[date] = None
    amount: Optional[float] = Field(None, ge=0)
    currency: Optional[Currency3] = None
    is_done: Optional[bool] = None


class ObligationOut(BaseModel):
    id: int
    title: str
    due_date: date
    amount: float
    currency: str
    is_done: bool

    class Config:
        from_attributes = True


# ===== Routes =====

@router.get("", response_model=List[ObligationOut])
def list_obligations(
    only_open: bool = Query(False),
    month: Optional[str] = Query(None, description="YYYY-MM; если задано — фильтр по месяцу"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(BudgetObligation).where(BudgetObligation.user_id == user.id)
    if only_open:
        q = q.where(BudgetObligation.is_done.is_(False))
    if month:
        # YYYY-MM -> фильтруем по началу месяца
        y, m = month.split("-")
        q = q.where(
            func.date_trunc("month", BudgetObligation.due_date)
            == func.to_date(f"{y}-{m}-01", "YYYY-MM-DD")
        )
    rows = db.execute(q.order_by(BudgetObligation.due_date.asc(), BudgetObligation.id.asc())).scalars().all()
    return rows


@router.post("", response_model=ObligationOut)
def create_obligation(
    payload: ObligationCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = BudgetObligation(
        user_id=user.id,
        title=payload.title,
        due_date=payload.due_date,
        amount=payload.amount,
        currency=payload.currency.upper(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{oid}", response_model=ObligationOut)
def update_obligation(
    oid: int,
    payload: ObligationUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.get(BudgetObligation, oid)
    if not row or row.user_id != user.id:
        raise HTTPException(404, "Not found")

    if payload.title is not None:
        row.title = payload.title
    if payload.due_date is not None:
        row.due_date = payload.due_date
    if payload.amount is not None:
        row.amount = payload.amount
    if payload.currency is not None:
        row.currency = payload.currency.upper()
    if payload.is_done is not None:
        row.is_done = payload.is_done

    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{oid}")
def delete_obligation(
    oid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.get(BudgetObligation, oid)
    if not row or row.user_id != user.id:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"status": "ok"}
