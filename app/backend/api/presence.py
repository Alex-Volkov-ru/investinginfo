from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.backend.core.auth import get_staff_user
from app.backend.core.config import get_settings
from app.backend.core.constants import ERROR_INVALID_TOKEN, ERROR_USER_NOT_FOUND
from app.backend.db.session import SessionLocal, get_db
from app.backend.models.user import User
from app.backend.services.presence import presence_service
from fastapi import Depends

log = logging.getLogger("presence.ws")
router = APIRouter()
settings = get_settings()


def _user_from_token(token: str, db: Session) -> User | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub", "0"))
    except (JWTError, ValueError):
        return None
    return db.query(User).filter(User.id == user_id).first()


@router.websocket("/ws/presence")
async def presence_websocket(websocket: WebSocket, token: str = Query(...)) -> None:
    db = SessionLocal()
    user: User | None = None
    is_staff = False
    try:
        user = _user_from_token(token, db)
        if not user:
            await websocket.close(code=4401, reason=ERROR_INVALID_TOKEN)
            return

        await websocket.accept()
        is_staff = bool(user.is_staff)

        became_online = await presence_service.connect(user.id)
        if became_online:
            await presence_service.publish(
                {
                    "type": "online",
                    "user_id": user.id,
                    "email": user.email,
                    "tg_username": user.tg_username,
                }
            )

        if is_staff:
            await presence_service.register_staff(websocket)
            snapshot = await presence_service.build_snapshot(db)
            await websocket.send_json({"type": "snapshot", "users": snapshot})

        while True:
            raw = await websocket.receive_text()
            if raw == "ping":
                await presence_service.touch(user.id)
                await websocket.send_json({"type": "pong"})
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                await presence_service.touch(user.id)
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("presence websocket error user_id=%s", getattr(user, "id", None))
    finally:
        if user is not None:
            if is_staff:
                await presence_service.unregister_staff(websocket)
            try:
                became_offline = await presence_service.disconnect(user.id)
                if became_offline:
                    await presence_service.publish({"type": "offline", "user_id": user.id})
            except Exception:
                log.exception("presence disconnect cleanup failed user_id=%s", user.id)
        db.close()


@router.get("/admin/presence/online")
async def list_online_users(
    admin: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
):
    """REST fallback: текущий список онлайн-пользователей."""
    users = await presence_service.build_snapshot(db)
    return {"users": users, "count": len(users)}
