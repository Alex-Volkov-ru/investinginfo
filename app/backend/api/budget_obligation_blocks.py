from __future__ import annotations
from typing import List, Optional
import datetime as dt
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.db.session import get_db
from app.backend.core.auth import get_current_user
from app.backend.core.constants import (
    DEFAULT_DUE_DAY,
    DEFAULT_OBLIGATION_STATUS,
    DEFAULT_OBLIGATION_TITLE,
    DEFAULT_PAYMENTS_COUNT,
    SATURDAY,
    SUNDAY,
    MONTH_END_CALC_DAY,
    MONTH_END_CALC_OFFSET,
    DAYS_IN_YEAR,
    ROUNDING_PRECISION,
    PERCENT_DIVISOR,
    PERCENT_TO_DECIMAL,
    ERROR_NOT_FOUND,
)
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
    due_day: int = DEFAULT_DUE_DAY

    # дата начала начисления процентов (обычно дата выдачи)
    start_date: Optional[dt.date] = None

    next_payment: Optional[dt.date] = None
    close_date: Optional[dt.date] = None
    status: str = DEFAULT_OBLIGATION_STATUS
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
        raise HTTPException(404, ERROR_NOT_FOUND)

def _q2(x: float | Decimal) -> float:
    return float(Decimal(str(x)).quantize(ROUNDING_PRECISION, rounding=ROUND_HALF_UP))

def _next_business_day(d: dt.date) -> dt.date:
    """Если выпало на выходной — переносим на следующий рабочий."""
    wd = d.weekday()  # 0=Mon..6=Sun
    if wd == SATURDAY:
        return d + dt.timedelta(days=2)
    if wd == SUNDAY:
        return d + dt.timedelta(days=1)
    return d

def _month_end(d: dt.date) -> dt.date:
    first_next = (d.replace(day=1) + dt.timedelta(days=MONTH_END_CALC_DAY + MONTH_END_CALC_OFFSET)).replace(day=1)
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
        nm_first = (block.start_date.replace(day=1) + dt.timedelta(days=MONTH_END_CALC_DAY + MONTH_END_CALC_OFFSET)).replace(day=1)
        return _due_for_month(nm_first.year, nm_first.month, int(block.due_day or DEFAULT_DUE_DAY))
    return None

# ---------- Interest & principal allocation (ACT/365F) ----------

def _calc_metrics_exact(block: ObligationBlock) -> dict:
    """
    Точный расчёт: проценты считаем по фактическим дням между событиями (ACT/365F).
    Каждый отмеченный платёж сначала гасит проценты за период с предыдущей даты,
    остаток идёт в тело. Округление HALF_UP до копеек на каждом шаге.
    """
    total = float(block.total or 0)
    balance = Decimal(str(total)).quantize(ROUNDING_PRECISION, rounding=ROUND_HALF_UP)
    rate_year = Decimal(str(block.rate or 0)) / Decimal(str(PERCENT_DIVISOR))

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
        interest = (balance * rate_year * Decimal(days) / Decimal(str(DAYS_IN_YEAR))).quantize(ROUNDING_PRECISION, rounding=ROUND_HALF_UP)

        amt = Decimal(str(p.amount or 0)).quantize(ROUNDING_PRECISION, rounding=ROUND_HALF_UP)
        interest_part = amt if amt <= interest else interest
        principal_part = amt - interest_part
        if principal_part > balance:
            principal_part = balance

        balance   = (balance - principal_part).quantize(ROUNDING_PRECISION, rounding=ROUND_HALF_UP)
        paid_int  = (paid_int + interest_part).quantize(ROUNDING_PRECISION, rounding=ROUND_HALF_UP)
        paid_pr   = (paid_pr  + principal_part).quantize(ROUNDING_PRECISION, rounding=ROUND_HALF_UP)
        paid_tot  = (paid_tot + amt).quantize(ROUNDING_PRECISION, rounding=ROUND_HALF_UP)

        prev_date = p.date

    progress_pct = (float(paid_pr) / total * PERCENT_TO_DECIMAL) if total > 0 else 0.0

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
    title = (payload.title or "").strip() or DEFAULT_OBLIGATION_TITLE
    block = ObligationBlock(
        user_id=user.id,
        title=title,
        total=payload.total or 0,
        monthly=payload.monthly or 0,
        rate=payload.rate or 0,
        due_day=payload.due_day or DEFAULT_DUE_DAY,
        start_date=payload.start_date,
        next_payment=payload.next_payment,
        close_date=payload.close_date,
        status=payload.status or DEFAULT_OBLIGATION_STATUS,
        notes=payload.notes or "",
    )
    # по умолчанию создаем платежи для удобства (можно добавлять больше)
    for i in range(1, DEFAULT_PAYMENTS_COUNT + 1):
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
        title=(payload.title or "").strip() or DEFAULT_OBLIGATION_TITLE,
        total=payload.total or 0,
        monthly=payload.monthly or 0,
        rate=payload.rate or 0,
        due_day=payload.due_day or DEFAULT_DUE_DAY,
        start_date=payload.start_date,
        next_payment=payload.next_payment,
        close_date=payload.close_date,
        status=payload.status or DEFAULT_OBLIGATION_STATUS,
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
    try:
        block = db.get(ObligationBlock, block_id)
        _ensure_owner(block, user.id)

        new_title = (payload.title or "").strip()
        if new_title:
            block.title = new_title
        block.total = payload.total or 0
        block.monthly = payload.monthly or 0
        block.rate = payload.rate or 0
        block.due_day = payload.due_day or DEFAULT_DUE_DAY
        block.start_date = payload.start_date
        block.next_payment = payload.next_payment
        block.close_date = payload.close_date
        block.status = payload.status or DEFAULT_OBLIGATION_STATUS
        block.notes = payload.notes or ""

        # Загружаем платежи, если они еще не загружены
        if not block.payments:
            db.refresh(block, ["payments"])

        by_id = {p.id: p for p in block.payments if p.id}
        by_n = {p.n: p for p in block.payments if p.n is not None}  # Для поиска по номеру, если id отсутствует
        seen = set()
        
        for p in payload.payments or []:
            # Ищем существующий платеж по id
            if p.id and p.id in by_id:
                row = by_id[p.id]
                row.n = p.n
                row.ok = bool(p.ok)
                row.date = p.date
                row.amount = p.amount or 0
                row.note = p.note or ""
                seen.add(row.id)
            # Если id нет, но есть номер - ищем по номеру (для случаев, когда id не был передан)
            elif p.n is not None and p.n in by_n:
                row = by_n[p.n]
                # Обновляем только если платеж еще не был обработан
                if row.id not in seen:
                    row.ok = bool(p.ok)
                    row.date = p.date
                    row.amount = p.amount or 0
                    row.note = p.note or ""
                    seen.add(row.id)
            # Создаем новый платеж только если его действительно нет
            else:
                if p.n is None:
                    # Пропускаем платежи без номера
                    continue
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
                if row.id:
                    seen.add(row.id)

        to_delete = [r for r in block.payments if r.id and r.id not in seen]
        for r in to_delete:
            db.delete(r)

        db.commit()
        db.refresh(block)
        return _block_to_dto(block)
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении блока: {error_detail}")

@router.delete("/{block_id}")
def delete_block(block_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    block = db.get(ObligationBlock, block_id)
    _ensure_owner(block, user.id)
    db.delete(block)
    db.commit()
    return {"status": "ok"}


# ===== Напоминания о платежах =====

class UpcomingPaymentDTO(BaseModel):
    block_id: int
    block_title: str
    payment_date: dt.date
    amount: float
    days_until: int  # Сколько дней осталось
    is_urgent: bool  # <= 1 дня
    is_warning: bool  # 2-3 дня

    class Config:
        from_attributes = True


@router.get("/upcoming-payments", response_model=List[UpcomingPaymentDTO])
def get_upcoming_payments(
    days_ahead: int = Query(7, ge=1, le=30, description="На сколько дней вперед смотреть"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Возвращает список ближайших платежей по всем активным кредитам пользователя.
    """
    today = dt.date.today()
    end_date = today + dt.timedelta(days=days_ahead)
    
    blocks = (
        db.query(ObligationBlock)
        .filter(
            ObligationBlock.user_id == user.id,
            ObligationBlock.status == DEFAULT_OBLIGATION_STATUS
        )
        .all()
    )
    
    upcoming = []
    for block in blocks:
        # Определяем дату следующего платежа
        next_date = None
        
        # Вариант 1: Используем next_payment если задано
        if block.next_payment and block.next_payment >= today:
            next_date = block.next_payment
        
        # Вариант 2: Ищем первый неоплаченный платеж с датой
        if not next_date:
            unpaid = [p for p in block.payments if not p.ok and p.date and p.date >= today]
            if unpaid:
                unpaid.sort(key=lambda x: x.date)
                next_date = unpaid[0].date
        
        # Вариант 3: Вычисляем на основе start_date + due_day
        if not next_date and block.start_date:
            next_date = _first_due(block)
            if next_date and next_date < today:
                # Если прошло, берем следующий месяц
                next_month = (today.replace(day=1) + dt.timedelta(days=MONTH_END_CALC_DAY + MONTH_END_CALC_OFFSET)).replace(day=1)
                next_date = _due_for_month(next_month.year, next_month.month, block.due_day or DEFAULT_DUE_DAY)
        
        if next_date and next_date <= end_date:
            days_until = (next_date - today).days
            
            upcoming.append(UpcomingPaymentDTO(
                block_id=block.id,
                block_title=block.title,
                payment_date=next_date,
                amount=float(block.monthly or 0),
                days_until=days_until,
                is_urgent=days_until <= 1,  # Срочно если <= 1 дня
                is_warning=1 < days_until <= 3,  # Предупреждение если 2-3 дня
            ))
    
    # Сортируем по дате (ближайшие первые)
    upcoming.sort(key=lambda x: x.payment_date)
    return upcoming
