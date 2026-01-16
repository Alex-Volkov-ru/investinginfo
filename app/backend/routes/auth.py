from __future__ import annotations
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from sqlalchemy.orm import Session

from app.backend.core.security import verify_password, hash_password, encrypt_token
from app.backend.core.auth import create_access_token
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.core.config import get_settings

router = APIRouter()
settings = get_settings()

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    tg_username: Optional[str] = None
    phone: Optional[str] = None
    tinkoff_token: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 6 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Пароль должен содержать минимум 6 символов, буквы и цифры")
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

class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: EmailStr
    tg_username: str | None = None
    has_tinkoff: bool = False 

@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Неверный email или пароль")
    token = create_access_token(user.id, settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    # Обновляем last_login_at
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return LoginOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        tg_username=user.tg_username,
        has_tinkoff=user.has_tinkoff_token,
    )

@router.post("/register", response_model=LoginOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    # Проверяем, существует ли пользователь
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(409, "Пользователь с таким email уже существует")
    
    # Создаем нового пользователя
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        tg_username=payload.tg_username,
        phone=payload.phone,
        created_at=datetime.now(timezone.utc),
    )
    
    # Шифруем токен Тинькофф, если указан
    if payload.tinkoff_token:
        user.tinkoff_token_enc = encrypt_token(payload.tinkoff_token)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Создаем токен и возвращаем
    token = create_access_token(user.id, settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return LoginOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        tg_username=user.tg_username,
        has_tinkoff=user.has_tinkoff_token,
    )