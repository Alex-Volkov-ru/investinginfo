from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.backend.core.cache import get_redis
from app.backend.models.user import User

log = logging.getLogger("presence")

PRESENCE_ONLINE_SET = "presence:online"
PRESENCE_COUNT_PREFIX = "presence:count:"
PRESENCE_CHANNEL = "presence:events"

_staff_sockets: set[WebSocket] = set()
_staff_lock = asyncio.Lock()


class PresenceService:
    async def connect(self, user_id: int) -> bool:
        r = await get_redis()
        key = f"{PRESENCE_COUNT_PREFIX}{user_id}"
        count = await r.incr(key)
        await r.expire(key, 86400)
        if count == 1:
            await r.sadd(PRESENCE_ONLINE_SET, str(user_id))
            return True
        return False

    async def disconnect(self, user_id: int) -> bool:
        r = await get_redis()
        key = f"{PRESENCE_COUNT_PREFIX}{user_id}"
        count = await r.decr(key)
        if count <= 0:
            await r.delete(key)
            await r.srem(PRESENCE_ONLINE_SET, str(user_id))
            return True
        return False

    async def touch(self, user_id: int) -> None:
        r = await get_redis()
        key = f"{PRESENCE_COUNT_PREFIX}{user_id}"
        if await r.exists(key):
            await r.expire(key, 86400)

    async def get_online_user_ids(self) -> set[int]:
        r = await get_redis()
        raw = await r.smembers(PRESENCE_ONLINE_SET)
        return {int(x) for x in raw}

    async def build_snapshot(self, db: Session) -> list[dict[str, Any]]:
        ids = await self.get_online_user_ids()
        if not ids:
            return []
        users = db.query(User).filter(User.id.in_(ids)).all()
        return [
            {
                "user_id": u.id,
                "email": u.email,
                "tg_username": u.tg_username,
            }
            for u in users
        ]

    async def publish(self, event: dict[str, Any]) -> None:
        try:
            r = await get_redis()
            await r.publish(PRESENCE_CHANNEL, json.dumps(event))
        except Exception:
            log.exception("presence publish failed")

    async def register_staff(self, ws: WebSocket) -> None:
        async with _staff_lock:
            _staff_sockets.add(ws)

    async def unregister_staff(self, ws: WebSocket) -> None:
        async with _staff_lock:
            _staff_sockets.discard(ws)

    async def broadcast_to_staff(self, event: dict[str, Any]) -> None:
        async with _staff_lock:
            dead: list[WebSocket] = []
            for ws in list(_staff_sockets):
                try:
                    await ws.send_json(event)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                _staff_sockets.discard(ws)

    async def run_event_listener(self) -> None:
        r = await get_redis()
        pubsub = r.pubsub()
        await pubsub.subscribe(PRESENCE_CHANNEL)
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    event = json.loads(message["data"])
                    await self.broadcast_to_staff(event)
                except Exception:
                    log.exception("presence event handling failed")
        except asyncio.CancelledError:
            raise
        finally:
            try:
                await pubsub.unsubscribe(PRESENCE_CHANNEL)
                await pubsub.aclose()
            except Exception:
                pass


presence_service = PresenceService()
