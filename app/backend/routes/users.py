from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user, get_staff_user
from app.backend.core.security import hash_password, encrypt_token
from app.backend.core.constants import (
    MIN_PASSWORD_LENGTH,
    PASSWORD_PATTERN_LETTERS,
    PASSWORD_PATTERN_DIGITS,
    MIN_USERNAME_LENGTH,
    PHONE_PATTERN,
    ERROR_PASSWORD_WEAK,
    ERROR_USERNAME_SHORT,
    ERROR_PHONE_FORMAT,
    ERROR_USER_EXISTS,
    ERROR_USER_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_404_NOT_FOUND,
)
from app.backend.db.session import get_db
from app.backend.models.user import User

router = APIRouter()

# === Schemas ===

class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    tg_username: Optional[str] = None
    phone: Optional[str] = None
    tinkoff_token: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < MIN_PASSWORD_LENGTH or not re.search(PASSWORD_PATTERN_LETTERS, v) or not re.search(PASSWORD_PATTERN_DIGITS, v):
            raise ValueError(ERROR_PASSWORD_WEAK)
        return v

    @field_validator("tg_username")
    @classmethod
    def name_min(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) < MIN_USERNAME_LENGTH:
            raise ValueError(ERROR_USERNAME_SHORT)
        return v

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if not re.fullmatch(PHONE_PATTERN, v):
            raise ValueError(ERROR_PHONE_FORMAT)
        return v

class UserMeOut(BaseModel):
    id: int
    email: EmailStr
    tg_username: Optional[str] = None
    has_tinkoff: bool = False
    is_staff: bool = False

class TokenUpdateIn(BaseModel):
    tinkoff_token: Optional[str] = None

class UserNameUpdateIn(BaseModel):
    tg_username: str

    @field_validator("tg_username")
    @classmethod
    def name_min(cls, v: str) -> str:
        v = v.strip()
        if len(v) < MIN_USERNAME_LENGTH:
            raise ValueError(ERROR_USERNAME_SHORT)
        return v

class UserEmailUpdateIn(BaseModel):
    email: EmailStr

class UserListOut(BaseModel):
    id: int
    email: EmailStr
    tg_username: Optional[str] = None
    is_staff: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None

class StaffToggleIn(BaseModel):
    user_id: int
    is_staff: bool

# === Routes ===

@router.post("/register", response_model=UserMeOut)
def register(payload: UserCreateIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(HTTP_409_CONFLICT, ERROR_USER_EXISTS)

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
        id=u.id, email=u.email, tg_username=u.tg_username, has_tinkoff=u.has_tinkoff_token, is_staff=u.is_staff
    )

@router.get("/me", response_model=UserMeOut)
def me(user: User = Depends(get_current_user)):
    return UserMeOut(
        id=user.id, email=user.email, tg_username=user.tg_username, has_tinkoff=user.has_tinkoff_token, is_staff=user.is_staff
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
        id=user.id, email=user.email, tg_username=user.tg_username, has_tinkoff=user.has_tinkoff_token, is_staff=user.is_staff
    )

@router.put("/me/name", response_model=UserMeOut)
def update_name(payload: UserNameUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.tg_username = payload.tg_username.strip()
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserMeOut(
        id=user.id, email=user.email, tg_username=user.tg_username, has_tinkoff=user.has_tinkoff_token, is_staff=user.is_staff
    )

@router.put("/me/email", response_model=UserMeOut)
def update_email(payload: UserEmailUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email, User.id != user.id).first()
    if existing:
        raise HTTPException(HTTP_409_CONFLICT, ERROR_USER_EXISTS)
    user.email = payload.email
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserMeOut(
        id=user.id, email=user.email, tg_username=user.tg_username, has_tinkoff=user.has_tinkoff_token, is_staff=user.is_staff
    )

@router.get("/list", response_model=list[UserListOut])
def list_users(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    """
    Получить список всех пользователей. Только для администраторов.
    """
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        UserListOut(
            id=u.id,
            email=u.email,
            tg_username=u.tg_username,
            is_staff=u.is_staff,
            created_at=u.created_at or datetime.utcnow(),
            last_login_at=u.last_login_at,
        )
        for u in users
    ]

@router.put("/toggle-staff", response_model=UserListOut)
def toggle_staff(
    payload: StaffToggleIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    """
    Изменить статус is_staff пользователя. Только для администраторов.
    """
    target_user = db.query(User).filter(User.id == payload.user_id).first()
    if not target_user:
        raise HTTPException(HTTP_404_NOT_FOUND, ERROR_USER_NOT_FOUND)
    
    target_user.is_staff = payload.is_staff
    db.add(target_user)
    db.commit()
    db.refresh(target_user)
    
    return UserListOut(
        id=target_user.id,
        email=target_user.email,
        tg_username=target_user.tg_username,
        is_staff=target_user.is_staff,
        created_at=target_user.created_at or datetime.utcnow(),
        last_login_at=target_user.last_login_at,
    )

@router.put("/{user_id}/name", response_model=UserListOut)
def admin_update_name(
    user_id: int,
    payload: UserNameUpdateIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    """
    Изменить имя пользователя. Только для администраторов.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(HTTP_404_NOT_FOUND, ERROR_USER_NOT_FOUND)
    
    target_user.tg_username = payload.tg_username.strip()
    db.add(target_user)
    db.commit()
    db.refresh(target_user)
    
    return UserListOut(
        id=target_user.id,
        email=target_user.email,
        tg_username=target_user.tg_username,
        is_staff=target_user.is_staff,
        created_at=target_user.created_at or datetime.utcnow(),
        last_login_at=target_user.last_login_at,
    )

@router.put("/{user_id}/email", response_model=UserListOut)
def admin_update_email(
    user_id: int,
    payload: UserEmailUpdateIn,
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    """
    Изменить email пользователя. Только для администраторов.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(HTTP_404_NOT_FOUND, ERROR_USER_NOT_FOUND)
    
    existing = db.query(User).filter(User.email == payload.email, User.id != user_id).first()
    if existing:
        raise HTTPException(HTTP_409_CONFLICT, ERROR_USER_EXISTS)
    
    target_user.email = payload.email
    db.add(target_user)
    db.commit()
    db.refresh(target_user)
    
    return UserListOut(
        id=target_user.id,
        email=target_user.email,
        tg_username=target_user.tg_username,
        is_staff=target_user.is_staff,
        created_at=target_user.created_at or datetime.utcnow(),
        last_login_at=target_user.last_login_at,
    )
