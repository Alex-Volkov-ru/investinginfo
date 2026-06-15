from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.backend.core.security import verify_password, hash_password, encrypt_token
from app.backend.core.auth import create_access_token
from app.backend.core.cache import rate_limit
from app.backend.core.constants import (
    PHONE_PATTERN,
    LOGIN_RATE_LIMIT,
    LOGIN_RATE_WINDOW_SEC,
    REGISTER_RATE_LIMIT,
    REGISTER_RATE_WINDOW_SEC,
    ERROR_PHONE_FORMAT,
    ERROR_INVALID_CREDENTIALS,
    ERROR_USER_EXISTS,
    HTTP_401_UNAUTHORIZED,
    HTTP_409_CONFLICT,
)
from app.backend.core.validators import validate_email, validate_password, validate_service_login
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.core.config import get_settings
import re

router = APIRouter()
settings = get_settings()


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return validate_email(v)


class RegisterIn(BaseModel):
    email: str
    password: str
    tg_username: str
    phone: Optional[str] = None
    tinkoff_token: Optional[str] = None

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return validate_email(v)

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password(v)

    @field_validator("tg_username")
    @classmethod
    def service_login_valid(cls, v: str) -> str:
        result = validate_service_login(v, required=True)
        return result  # type: ignore[return-value]

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if not re.fullmatch(PHONE_PATTERN, v):
            raise ValueError(ERROR_PHONE_FORMAT)
        return v


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    tg_username: str | None = None
    has_tinkoff: bool = False
    is_staff: bool = False


@router.post("/login", response_model=LoginOut)
async def login(payload: LoginIn, db: Session = Depends(get_db)):
    await rate_limit(f"login:email:{payload.email}", limit=LOGIN_RATE_LIMIT, window_sec=LOGIN_RATE_WINDOW_SEC)

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(HTTP_401_UNAUTHORIZED, ERROR_INVALID_CREDENTIALS)
    token = create_access_token(user.id, settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return LoginOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        tg_username=user.tg_username,
        has_tinkoff=user.has_tinkoff_token,
        is_staff=user.is_staff,
    )


@router.post("/register", response_model=LoginOut)
async def register(payload: RegisterIn, db: Session = Depends(get_db)):
    await rate_limit("register:ip", limit=REGISTER_RATE_LIMIT, window_sec=REGISTER_RATE_WINDOW_SEC)

    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(HTTP_409_CONFLICT, ERROR_USER_EXISTS)

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        tg_username=payload.tg_username,
        phone=payload.phone,
        created_at=datetime.now(timezone.utc),
    )

    if payload.tinkoff_token:
        user.tinkoff_token_enc = encrypt_token(payload.tinkoff_token)

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return LoginOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        tg_username=user.tg_username,
        has_tinkoff=user.has_tinkoff_token,
        is_staff=user.is_staff,
    )
