from __future__ import annotations
import re
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.core.security import hash_password
from app.backend.db.session import get_db
from app.backend.models.user import User

router = APIRouter()

class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    tg_username: str
    phone: str | None = None

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if len(v) < 6 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Пароль должен быть не короче 6 символов и содержать буквы и цифры")
        return v

    @field_validator("tg_username")
    @classmethod
    def name_min(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Имя слишком короткое")
        return v

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: str | None) -> str | None:
        if not v:
            return None
        if not re.fullmatch(r"\+?\d{10,15}", v):
            raise ValueError("Телефон должен содержать 10–15 цифр (можно + в начале)")
        return v

class UserOut(BaseModel):
    id: int
    email: EmailStr
    tg_username: str | None = None
    phone: str | None = None
    class Config:
        from_attributes = True

class UserMeOut(BaseModel):
    id: int
    email: EmailStr
    tg_username: str | None = None

@router.post("", response_model=UserOut)
def create_user(payload: UserCreateIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "email уже зарегистрирован")
    if payload.phone and db.query(User).filter(User.phone == payload.phone).first():
        raise HTTPException(409, "телефон уже используется")

    u = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        tg_username=payload.tg_username,
        phone=payload.phone,
        created_at=datetime.utcnow(),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@router.get("/me", response_model=UserMeOut)
def me(user: User = Depends(get_current_user)):
    return UserMeOut(id=user.id, email=user.email, tg_username=user.tg_username)
