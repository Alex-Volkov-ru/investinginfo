from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.backend.core.config import get_settings
from app.backend.core.cache import close_redis
from app.backend.core.constants import (
    APP_TITLE,
    APP_VERSION,
    ALLOWED_HTTP_METHODS,
    ALLOWED_HTTP_HEADERS,
    CORS_PREFLIGHT_MAX_AGE,
)
from app.backend.db.session import engine

from app.backend.routes.init import api_router

# твои бюджетные эндпоинты
from app.backend.api.budget_accounts import router as budget_accounts_router
from app.backend.api.budget_categories import router as budget_categories_router
from app.backend.api.budget_transactions import router as budget_transactions_router
from app.backend.api.budget_summary import router as budget_summary_router
from app.backend.api.budget_obligations import router as budget_obligations_router
from app.backend.api.budget_obligation_blocks import router as budget_obligation_blocks_router
from app.backend.api.backups import router as backups_router
from app.backend.api.monthly_review import router as monthly_review_router
from app.backend.api.whiteboard import router as whiteboard_router
from app.backend.api.admin import router as admin_router
from app.backend.api.admin_enhancements import router as admin_enhancements_router
from app.backend.api.presence import router as presence_router
from app.backend.services.presence import presence_service

settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG))
log = logging.getLogger("startup")

async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    with engine.connect() as conn:
        schema = conn.execute(text("SHOW search_path")).scalar()
        log.info(f"DB connected. search_path = {schema}")
    listener_task = asyncio.create_task(presence_service.run_event_listener())
    yield
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass
    await close_redis()
    log.info("Server shutdown")

def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan, title=APP_TITLE, version=APP_VERSION)

    # CORS: если указан "*", отключаем credentials для безопасности
    allow_credentials = not ("*" in settings.ALLOWED_ORIGINS)
    allowed_origins = settings.ALLOWED_ORIGINS if settings.ALLOWED_ORIGINS else ["*"]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=allow_credentials,
        allow_methods=ALLOWED_HTTP_METHODS,
        allow_headers=ALLOWED_HTTP_HEADERS,
        expose_headers=["*"],
        max_age=CORS_PREFLIGHT_MAX_AGE,
    )

    # Роутеры
    app.include_router(api_router)
    app.include_router(budget_accounts_router)
    app.include_router(budget_categories_router)
    app.include_router(budget_transactions_router)
    app.include_router(budget_summary_router)
    app.include_router(budget_obligations_router)
    app.include_router(budget_obligation_blocks_router)
    app.include_router(backups_router)
    app.include_router(monthly_review_router)
    app.include_router(whiteboard_router)
    app.include_router(admin_router)
    app.include_router(admin_enhancements_router)
    app.include_router(presence_router)

    return app

app = create_app()
