from __future__ import annotations

from datetime import datetime, timezone, date
from decimal import Decimal
from typing import List, Optional, Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, ConfigDict
from pydantic.types import StringConstraints
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.core.security import encrypt_amount
from app.backend.core.constants import (
    ERROR_NOT_FOUND,
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
    TRANSACTION_TYPE_INCOME,
    TRANSACTION_TYPE_EXPENSE,
    DEFAULT_CURRENCY,
    ERROR_ACCOUNTS_UNAVAILABLE,
    ERROR_CATEGORY_REQUIRED_TEMPLATE,
)
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.whiteboard import Whiteboard
from app.backend.models.budget import BudgetTransaction, BudgetAccount, BudgetCategory

router = APIRouter(prefix="/whiteboard", tags=["whiteboard"])

MAX_CANVAS_DATA_LEN = 1_000_000
NameStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class WhiteboardZoneIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=100)
    color: str = Field(min_length=4, max_length=16)
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(ge=80, le=1200)
    height: float = Field(ge=80, le=800)
    priority: int = Field(ge=1, le=10, default=1)
    locked: Optional[bool] = False


class WhiteboardItemIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    kind: Optional[str] = Field(default="expense")
    title: str = Field(min_length=1, max_length=200)
    amount: float = Field(ge=0)
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: Optional[float] = Field(default=None, ge=60, le=1200)
    height: Optional[float] = Field(default=None, ge=60, le=800)
    category_id: Optional[int] = None
    zone_id: Optional[str] = Field(default=None, max_length=64)
    color: Optional[str] = Field(default=None, max_length=16)


class WhiteboardCreateIn(BaseModel):
    name: NameStr
    budget: float = Field(ge=0, default=0)
    items: List[WhiteboardItemIn] = Field(default_factory=list)
    zones: List[WhiteboardZoneIn] = Field(default_factory=list)
    canvas_data: Optional[str] = None

    @field_validator("canvas_data")
    @classmethod
    def validate_canvas_size(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > MAX_CANVAS_DATA_LEN:
            raise ValueError(f"canvas_data превышает лимит {MAX_CANVAS_DATA_LEN} символов")
        return v

    @field_validator("items")
    @classmethod
    def validate_items_count(cls, v: List[WhiteboardItemIn]) -> List[WhiteboardItemIn]:
        if len(v) > 500:
            raise ValueError("Слишком много карточек на доске (максимум 500)")
        return v


class WhiteboardUpdateIn(BaseModel):
    name: Optional[NameStr] = None
    budget: Optional[float] = Field(None, ge=0)
    items: Optional[List[WhiteboardItemIn]] = None
    zones: Optional[List[WhiteboardZoneIn]] = None
    canvas_data: Optional[str] = None

    @field_validator("canvas_data")
    @classmethod
    def validate_canvas_size(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > MAX_CANVAS_DATA_LEN:
            raise ValueError(f"canvas_data превышает лимит {MAX_CANVAS_DATA_LEN} символов")
        return v

    @field_validator("items")
    @classmethod
    def validate_items_count(cls, v: Optional[List[WhiteboardItemIn]]) -> Optional[List[WhiteboardItemIn]]:
        if v is not None and len(v) > 500:
            raise ValueError("Слишком много карточек на доске (максимум 500)")
        return v


class WhiteboardOut(BaseModel):
    id: int
    name: str
    budget: float
    items: List[Any]
    zones: List[Any] = Field(default_factory=list)
    canvas_data: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WhiteboardListItem(BaseModel):
    id: int
    name: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExportToBudgetIn(BaseModel):
    account_id: int
    occurred_at: Optional[str] = Field(None, description="YYYY-MM-DD")


class ExportToBudgetOut(BaseModel):
    created: int
    skipped: int
    transaction_ids: List[int]
    messages: List[str] = Field(default_factory=list)


def _serialize_board(board: Whiteboard) -> WhiteboardOut:
    return WhiteboardOut(
        id=board.id,
        name=board.name,
        budget=float(board.budget or 0),
        items=board.items or [],
        zones=board.zones or [],
        canvas_data=board.canvas_data,
        created_at=board.created_at,
        updated_at=board.updated_at,
    )


def _get_user_board(db: Session, user_id: int, board_id: int) -> Whiteboard:
    board = db.execute(
        select(Whiteboard).where(Whiteboard.id == board_id, Whiteboard.user_id == user_id)
    ).scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail=ERROR_NOT_FOUND)
    return board


@router.get("/latest", response_model=Optional[WhiteboardOut])
def get_latest_whiteboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    board = db.execute(
        select(Whiteboard)
        .where(Whiteboard.user_id == user.id)
        .order_by(desc(Whiteboard.updated_at))
        .limit(1)
    ).scalar_one_or_none()
    if not board:
        return None
    return _serialize_board(board)


@router.get("/list", response_model=List[WhiteboardListItem])
def list_whiteboards(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(Whiteboard)
        .where(Whiteboard.user_id == user.id)
        .order_by(desc(Whiteboard.updated_at))
    ).scalars().all()
    return rows


@router.get("/{board_id}", response_model=WhiteboardOut)
def get_whiteboard(
    board_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    board = _get_user_board(db, user.id, board_id)
    return _serialize_board(board)


@router.post("", response_model=WhiteboardOut)
def create_whiteboard(
    payload: WhiteboardCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    board = Whiteboard(
        user_id=user.id,
        name=payload.name,
        budget=payload.budget,
        items=[item.model_dump() for item in payload.items],
        zones=[z.model_dump() for z in payload.zones],
        canvas_data=payload.canvas_data,
    )
    db.add(board)
    db.commit()
    db.refresh(board)
    return _serialize_board(board)


@router.put("/{board_id}", response_model=WhiteboardOut)
def update_whiteboard(
    board_id: int,
    payload: WhiteboardUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    board = _get_user_board(db, user.id, board_id)

    if payload.name is not None:
        board.name = payload.name
    if payload.budget is not None:
        board.budget = payload.budget
    if payload.items is not None:
        board.items = [item.model_dump() for item in payload.items]
    if payload.zones is not None:
        board.zones = [z.model_dump() for z in payload.zones]
    if payload.canvas_data is not None:
        board.canvas_data = payload.canvas_data or None

    board.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(board)
    return _serialize_board(board)


@router.delete("/{board_id}")
def delete_whiteboard(
    board_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    board = _get_user_board(db, user.id, board_id)
    db.delete(board)
    db.commit()
    return {"ok": True}


@router.post("/{board_id}/export", response_model=ExportToBudgetOut)
def export_whiteboard_to_budget(
    board_id: int,
    payload: ExportToBudgetIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    board = _get_user_board(db, user.id, board_id)
    account: BudgetAccount | None = db.get(BudgetAccount, payload.account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(HTTP_400_BAD_REQUEST, detail=ERROR_ACCOUNTS_UNAVAILABLE)

    occurred = date.today()
    if payload.occurred_at:
        occurred = date.fromisoformat(payload.occurred_at)

    created = 0
    skipped = 0
    tx_ids: List[int] = []
    messages: List[str] = []

    for raw in board.items or []:
        kind = raw.get("kind", "expense")
        if kind not in (TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_EXPENSE):
            continue
        amount = float(raw.get("amount") or 0)
        if amount <= 0:
            skipped += 1
            messages.append(f"Пропущено «{raw.get('title', '')}»: нулевая сумма")
            continue

        category_id = raw.get("category_id")
        if not category_id:
            skipped += 1
            type_name = "доходов" if kind == TRANSACTION_TYPE_INCOME else "расходов"
            messages.append(
                f"Пропущено «{raw.get('title', '')}»: нет категории {type_name}"
            )
            continue

        category: BudgetCategory | None = db.get(BudgetCategory, category_id)
        if not category or category.user_id != user.id:
            skipped += 1
            messages.append(f"Пропущено «{raw.get('title', '')}»: категория не найдена")
            continue
        if category.kind != kind:
            skipped += 1
            messages.append(f"Пропущено «{raw.get('title', '')}»: тип категории не совпадает")
            continue

        tx = BudgetTransaction(
            user_id=user.id,
            type=kind,
            account_id=account.id,
            contra_account_id=None,
            category_id=category.id,
            amount=Decimal(str(amount)),
            amount_encrypted=encrypt_amount(Decimal(str(amount))),
            currency=DEFAULT_CURRENCY,
            occurred_at=occurred,
            description=raw.get("title") or None,
        )
        db.add(tx)
        db.flush()
        tx_ids.append(tx.id)
        created += 1

    db.commit()
    return ExportToBudgetOut(created=created, skipped=skipped, transaction_ids=tx_ids, messages=messages)
