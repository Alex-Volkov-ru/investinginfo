from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.core.security import hash_password, encrypt_token
from app.backend.db.session import get_db
from app.backend.models.user import User

router = APIRouter()

# === Schemas ===

class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    tg_username: Optional[str] = None
    phone: Optional[str] = None
    tinkoff_token: Optional[str] = None  # НОВОЕ

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 6 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Пароль слишком слабый")
        return v

    @field_validator("tg_username")
    @classmethod
    def name_min(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Имя слишком короткое")
        return v

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if not re.fullmatch(r"\+?\d{10,15}", v):
            raise ValueError("Телефон в формате +7999123... или 10–15 цифр")
        return v

class UserMeOut(BaseModel):
    id: int
    email: EmailStr
    tg_username: Optional[str] = None
    has_tinkoff: bool = False

class TokenUpdateIn(BaseModel):
    tinkoff_token: Optional[str] = None

# === Routes ===

@router.post("/register", response_model=UserMeOut)
def register(payload: UserCreateIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Пользователь с таким email уже существует")

    u = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        tg_username=payload.tg_username,
        phone=payload.phone,
        created_at=datetime.utcnow(),
    )

    if payload.tinkoff_token:
        u.tinkoff_token_enc = encrypt_token(payload.tinkoff_token)

    db.add(u)
    db.commit()
    db.refresh(u)
    return UserMeOut(
        id=u.id, email=u.email, tg_username=u.tg_username, has_tinkoff=u.has_tinkoff_token
    )

@router.get("/me", response_model=UserMeOut)
def me(user: User = Depends(get_current_user)):
    return UserMeOut(
        id=user.id, email=user.email, tg_username=user.tg_username, has_tinkoff=user.has_tinkoff_token
    )

@router.put("/me/token", response_model=UserMeOut)
def update_token(payload: TokenUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.tinkoff_token:
        user.tinkoff_token_enc = encrypt_token(payload.tinkoff_token.strip())
    else:
        user.tinkoff_token_enc = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserMeOut(
        id=user.id, email=user.email, tg_username=user.tg_username, has_tinkoff=user.has_tinkoff_token
    )
