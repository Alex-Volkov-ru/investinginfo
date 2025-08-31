from __future__ import annotations

import logging
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.backend.core.config import get_settings
from app.backend.core.cache import close_redis
from app.backend.db.session import engine

from app.backend.routes.init import api_router

# твои бюджетные эндпоинты
from app.backend.api.budget_accounts import router as budget_accounts_router
from app.backend.api.budget_categories import router as budget_categories_router
from app.backend.api.budget_transactions import router as budget_transactions_router
from app.backend.api.budget_summary import router as budget_summary_router
from app.backend.api.budget_obligations import router as budget_obligations_router

settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG))
log = logging.getLogger("startup")

async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    with engine.connect() as conn:
        schema = conn.execute(text("SHOW search_path")).scalar()
        log.info(f"DB connected. search_path = {schema}")
    yield
    await close_redis()
    log.info("Server shutdown")

def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan, title="Portfolio API", version="0.1.0")

    allow_credentials = not ("*" in settings.ALLOWED_ORIGINS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS if settings.ALLOWED_ORIGINS else ["*"],
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Роутеры
    app.include_router(api_router)
    app.include_router(budget_accounts_router)
    app.include_router(budget_categories_router)
    app.include_router(budget_transactions_router)
    app.include_router(budget_summary_router)
    app.include_router(budget_obligations_router)

    return app

app = create_app()
