from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.backend.core.security import verify_password
from app.backend.core.auth import create_access_token
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.core.config import get_settings

router = APIRouter()
settings = get_settings()

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: EmailStr
    tg_username: str | None = None 

@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Неверный email или пароль")
    token = create_access_token(user.id, settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return LoginOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        tg_username=user.tg_username,  # ← добавили
    )