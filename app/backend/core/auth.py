from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.backend.core.config import get_settings
from app.backend.core.constants import (
    ERROR_INVALID_TOKEN,
    ERROR_USER_NOT_FOUND,
    ERROR_ACCESS_DENIED,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
)
from app.backend.db.session import get_db
from app.backend.models.user import User

settings = get_settings()
security = HTTPBearer(auto_error=True)

def create_access_token(user_id: int, expires_minutes: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    exp_minutes = int(expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES or 60)  # 60 - дефолт из settings
    exp = now + timedelta(minutes=exp_minutes)
    payload = {"sub": str(user_id), "exp": exp}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = creds.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub", "0"))
    except (JWTError, ValueError):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail=ERROR_INVALID_TOKEN)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail=ERROR_USER_NOT_FOUND)
    return user

def get_staff_user(
    user: User = Depends(get_current_user),
) -> User:
    """
    Dependency для проверки административных прав.
    Используется в эндпоинтах, доступных только администраторам.
    """
    if not user.is_staff:
        raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail=ERROR_ACCESS_DENIED)
    return user
