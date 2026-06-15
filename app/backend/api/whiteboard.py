from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from pydantic.types import StringConstraints
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.core.constants import ERROR_NOT_FOUND, HTTP_404_NOT_FOUND
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.models.whiteboard import Whiteboard

router = APIRouter(prefix="/whiteboard", tags=["whiteboard"])

MAX_CANVAS_DATA_LEN = 1_000_000
NameStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class WhiteboardItemIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    kind: Optional[str] = Field(default="expense")
    title: str = Field(min_length=1, max_length=200)
    amount: float = Field(ge=0)
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: Optional[float] = Field(default=None, ge=60, le=600)
    height: Optional[float] = Field(default=None, ge=60, le=400)


class WhiteboardCreateIn(BaseModel):
    name: NameStr
    budget: float = Field(ge=0, default=0)
    items: List[WhiteboardItemIn] = Field(default_factory=list)
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
    canvas_data: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WhiteboardListItem(BaseModel):
    id: int
    name: str
    updated_at: datetime

    class Config:
        from_attributes = True


def _serialize_board(board: Whiteboard) -> WhiteboardOut:
    return WhiteboardOut(
        id=board.id,
        name=board.name,
        budget=float(board.budget or 0),
        items=board.items or [],
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
