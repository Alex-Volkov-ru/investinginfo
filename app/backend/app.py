from __future__ import annotations

import logging
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .routes.users import router as users_router

from .core.config import get_settings
from .db.session import engine

# агрегатор твоих старых эндпоинтов (где users в app/backend/routes/users.py)
from .routes.init import api_router

# бюджетные эндпоинты
from app.backend.api.budget_accounts import router as budget_accounts_router
from app.backend.api.budget_categories import router as budget_categories_router
from app.backend.api.budget_transactions import router as budget_transactions_router
from app.backend.api.budget_summary import router as budget_summary_router

settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG))
log = logging.getLogger("startup")


async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    with engine.connect() as conn:
        schema = conn.execute(text("SHOW search_path")).scalar()
        log.info(f"DB connected. search_path = {schema}")
    yield
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

    # старые маршруты (включая users из routes/users.py)
    app.include_router(api_router)

    # бюджетирование
    app.include_router(budget_accounts_router)
    app.include_router(budget_categories_router)
    app.include_router(budget_transactions_router)
    app.include_router(budget_summary_router)

    return app
