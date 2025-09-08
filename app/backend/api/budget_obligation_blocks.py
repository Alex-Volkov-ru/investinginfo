from __future__ import annotations
from typing import List, Optional
from datetime import date

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
    date: Optional[date] = None
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
    next_payment: Optional[date] = None
    close_date: Optional[date] = None
    status: str = "Активный"
    notes: str = ""

    # не мутируемый дефолт
    payments: List[PaymentDTO] = Field(default_factory=list)

    class Config:
        from_attributes = True

# ---------- Helpers ----------

def _block_to_dto(row: ObligationBlock) -> BlockDTO:
    return BlockDTO.model_validate(row)

def _ensure_owner(block: ObligationBlock | None, user_id: int):
    if not block or block.user_id != user_id:
        raise HTTPException(404, "Not found")

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
    title = (payload.title or "").strip() or "Обязательство"  # <- нормализация
    block = ObligationBlock(
        user_id=user.id,
        title=title,
        total=payload.total or 0,
        monthly=payload.monthly or 0,
        rate=payload.rate or 0,
        due_day=payload.due_day or 15,
        next_payment=payload.next_payment,
        close_date=payload.close_date,
        status=payload.status or "Активный",
        notes=payload.notes or "",
    )
    # создаём 12 пустых платежей
    for i in range(1, 13):
        block.payments.append(ObligationPayment(n=i, ok=False, amount=0, note=""))

    db.add(block)
    db.commit()
    db.refresh(block)
    return _block_to_dto(block)

@router.put("/{block_id}", response_model=BlockDTO)
def save_block(
    block_id: int,
    payload: BlockDTO,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    block = db.get(ObligationBlock, block_id)
    _ensure_owner(block, user.id)

    # поля блока
    new_title = (payload.title or "").strip()
    if new_title:  # только если прислали непустой
        block.title = new_title
    block.total = payload.total or 0
    block.monthly = payload.monthly or 0
    block.rate = payload.rate or 0
    block.due_day = payload.due_day or 15
    block.next_payment = payload.next_payment
    block.close_date = payload.close_date
    block.status = payload.status or "Активный"
    block.notes = payload.notes or ""

    # синхронизация платежей (по id, иначе insert)
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

    # удалить те, которых нет в payload
    to_delete = [r for r in block.payments if r.id not in seen]
    for r in to_delete:
        db.delete(r)

    db.commit()
    db.refresh(block)
    return _block_to_dto(block)

@router.delete("/{block_id}")
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    block = db.get(ObligationBlock, block_id)
    _ensure_owner(block, user.id)
    db.delete(block)
    db.commit()
    return {"status": "ok"}
