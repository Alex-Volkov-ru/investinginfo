from __future__ import annotations
from typing import List, Optional
import datetime as dt
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.db.session import get_db
from app.backend.core.auth import get_current_user
from app.backend.models.user import User
from app.backend.models.budget import ObligationBlock, ObligationPayment

router = APIRouter(prefix="/budget/obligation-blocks", tags=["budget:obligation-blocks"])

# ---------- Schemas ----------

class PaymentDTO(BaseModel):
    id: Optional[int] = None
    n: int
    ok: bool = False
    date: Optional[dt.date] = None
    amount: float = 0
    note: str = ""

    class Config:
        from_attributes = True

class BlockDTO(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None

    total: float = 0
    monthly: float = 0
    rate: float = 0
    due_day: int = 15

    # дата начала начисления процентов (обычно дата выдачи)
    start_date: Optional[dt.date] = None

    next_payment: Optional[dt.date] = None
    close_date: Optional[dt.date] = None
    status: str = "Активный"
    notes: str = ""

    payments: List[PaymentDTO] = Field(default_factory=list)

    # -------- computed (read-only) --------
    paid_total: float = 0
    paid_interest: float = 0
    paid_principal: float = 0
    remaining: float = 0
    progress_pct: float = 0

    class Config:
        from_attributes = True

# ---------- Helpers ----------

def _ensure_owner(block: ObligationBlock | None, user_id: int):
    if not block or block.user_id != user_id:
        raise HTTPException(404, "Not found")

def _q2(x: float | Decimal) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

def _next_business_day(d: dt.date) -> dt.date:
    """Если выпало на выходной — переносим на следующий рабочий."""
    wd = d.weekday()  # 0=Mon..6=Sun
    if wd == 5:   # Sat
        return d + dt.timedelta(days=2)
    if wd == 6:   # Sun
        return d + dt.timedelta(days=1)
    return d

def _month_end(d: dt.date) -> dt.date:
    first_next = (d.replace(day=1) + dt.timedelta(days=32)).replace(day=1)
    return first_next - dt.timedelta(days=1)

def _due_for_month(y: int, m: int, due_day: int) -> dt.date:
    base = dt.date(y, m, 1)
    day = min(due_day, _month_end(base).day)
    return _next_business_day(base.replace(day=day))

def _first_due(block: ObligationBlock) -> dt.date | None:
    """Первая плановая дата: next_payment или (месяц после start_date, due_day)."""
    if block.next_payment:
        return _next_business_day(block.next_payment)
    if block.start_date:
        nm_first = (block.start_date.replace(day=1) + dt.timedelta(days=32)).replace(day=1)
        return _due_for_month(nm_first.year, nm_first.month, int(block.due_day or 15))
    return None

# ---------- Interest & principal allocation (ACT/365F) ----------

def _calc_metrics_exact(block: ObligationBlock) -> dict:
    """
    Точный расчёт: проценты считаем по фактическим дням между событиями (ACT/365F).
    Каждый отмеченный платёж сначала гасит проценты за период с предыдущей даты,
    остаток идёт в тело. Округление HALF_UP до копеек на каждом шаге.
    """
    total = float(block.total or 0)
    balance = Decimal(str(total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    rate_year = Decimal(str(block.rate or 0)) / Decimal("100")

    if total <= 0 or rate_year < 0:
        return {"paid_total": 0.0, "paid_interest": 0.0, "paid_principal": 0.0,
                "remaining": max(0.0, total), "progress_pct": 0.0}

    pays = [p for p in (block.payments or []) if p.ok and p.date and float(p.amount or 0) > 0]
    pays.sort(key=lambda x: (x.date, x.n))

    if not pays:
        return {"paid_total": 0.0, "paid_interest": 0.0, "paid_principal": 0.0,
                "remaining": _q2(balance), "progress_pct": 0.0}

    # Точка отсчёта — start_date, если задан; иначе дата первого платежа
    prev_date: dt.date = block.start_date or pays[0].date

    paid_int = Decimal("0.00")
    paid_pr  = Decimal("0.00")
    paid_tot = Decimal("0.00")

    for p in pays:
        days = max(0, (p.date - prev_date).days)  # Actual days
        # проценты за период
        interest = (balance * rate_year * Decimal(days) / Decimal("365")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        amt = Decimal(str(p.amount or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        interest_part = amt if amt <= interest else interest
        principal_part = amt - interest_part
        if principal_part > balance:
            principal_part = balance

        balance   = (balance - principal_part).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        paid_int  = (paid_int + interest_part).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        paid_pr   = (paid_pr  + principal_part).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        paid_tot  = (paid_tot + amt).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        prev_date = p.date

    progress_pct = (float(paid_pr) / total * 100.0) if total > 0 else 0.0

    return {
        "paid_total": float(paid_tot),
        "paid_interest": float(paid_int),
        "paid_principal": float(paid_pr),
        "remaining": float(balance),
        "progress_pct": _q2(progress_pct),
    }

def _block_to_dto(row: ObligationBlock) -> BlockDTO:
    dto = BlockDTO.model_validate(row)
    metrics = _calc_metrics_exact(row)   # <-- используем точный расчёт
    data = dto.model_dump()
    data.update(metrics)
    return BlockDTO(**data)

# ---------- Endpoints ----------

@router.get("", response_model=List[BlockDTO])
def list_blocks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(ObligationBlock)
        .filter(ObligationBlock.user_id == user.id)
        .order_by(ObligationBlock.updated_at.desc())
        .all()
    )
    return [_block_to_dto(r) for r in rows]

@router.post("", response_model=BlockDTO, status_code=201)
def create_block(payload: BlockDTO, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    title = (payload.title or "").strip() or "Обязательство"
    block = ObligationBlock(
        user_id=user.id,
        title=title,
        total=payload.total or 0,
        monthly=payload.monthly or 0,
        rate=payload.rate or 0,
        due_day=payload.due_day or 15,
        start_date=payload.start_date,
        next_payment=payload.next_payment,
        close_date=payload.close_date,
        status=payload.status or "Активный",
        notes=payload.notes or "",
    )
    # по умолчанию 12 строк для удобства
    for i in range(1, 13):
        block.payments.append(ObligationPayment(n=i, ok=False, amount=0, note=""))

    db.add(block)
    db.commit()
    db.refresh(block)
    return _block_to_dto(block)

@router.post("/preview", response_model=BlockDTO)
def preview_block(payload: BlockDTO, user: User = Depends(get_current_user)):
    """
    Возвращает DTO с точно посчитанными метриками по присланным данным (без записи в БД).
    Удобно для живого предпросмотра графика на фронте.
    """
    fake = ObligationBlock(
        id=payload.id or 0,
        user_id=user.id,
        title=(payload.title or "").strip() or "Обязательство",
        total=payload.total or 0,
        monthly=payload.monthly or 0,
        rate=payload.rate or 0,
        due_day=payload.due_day or 15,
        start_date=payload.start_date,
        next_payment=payload.next_payment,
        close_date=payload.close_date,
        status=payload.status or "Активный",
        notes=payload.notes or "",
    )
    fake.payments = [
        ObligationPayment(
            id=p.id or 0,
            obligation_id=fake.id or 0,
            n=p.n,
            ok=bool(p.ok),
            date=p.date,
            amount=p.amount or 0,
            note=p.note or "",
        )
        for p in (payload.payments or [])
    ]
    dto = BlockDTO.model_validate(fake)
    data = dto.model_dump()
    data.update(_calc_metrics_exact(fake))
    return BlockDTO(**data)

@router.put("/{block_id}", response_model=BlockDTO)
def save_block(
    block_id: int,
    payload: BlockDTO,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    block = db.get(ObligationBlock, block_id)
    _ensure_owner(block, user.id)

    new_title = (payload.title or "").strip()
    if new_title:
        block.title = new_title
    block.total = payload.total or 0
    block.monthly = payload.monthly or 0
    block.rate = payload.rate or 0
    block.due_day = payload.due_day or 15
    block.start_date = payload.start_date
    block.next_payment = payload.next_payment
    block.close_date = payload.close_date
    block.status = payload.status or "Активный"
    block.notes = payload.notes or ""

    by_id = {p.id: p for p in block.payments}
    seen = set()
    for p in payload.payments or []:
        if p.id and p.id in by_id:
            row = by_id[p.id]
            row.n = p.n
            row.ok = bool(p.ok)
            row.date = p.date
            row.amount = p.amount or 0
            row.note = p.note or ""
            seen.add(row.id)
        else:
            row = ObligationPayment(
                obligation_id=block.id,
                n=p.n,
                ok=bool(p.ok),
                date=p.date,
                amount=p.amount or 0,
                note=p.note or "",
            )
            db.add(row)
            db.flush()
            seen.add(row.id)

    to_delete = [r for r in block.payments if r.id not in seen]
    for r in to_delete:
        db.delete(r)

    db.commit()
    db.refresh(block)
    return _block_to_dto(block)

@router.delete("/{block_id}")
def delete_block(block_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    block = db.get(ObligationBlock, block_id)
    _ensure_owner(block, user.id)
    db.delete(block)
    db.commit()
    return {"status": "ok"}
