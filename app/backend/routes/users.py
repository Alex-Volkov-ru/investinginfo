from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, EmailStr
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
    phone: str | None = None

class UserOut(BaseModel):
    id: int
    email: EmailStr
    phone: str | None = None
    class Config:
        from_attributes = True

class UserMeOut(BaseModel):
    id: int
    email: EmailStr

@router.post("", response_model=UserOut)
def create_user(payload: UserCreateIn, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise HTTPException(409, "email уже зарегистрирован")
    u = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        created_at=datetime.utcnow(),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@router.get("/me", response_model=UserMeOut)
def me(user: User = Depends(get_current_user)):
    return UserMeOut(id=user.id, email=user.email)