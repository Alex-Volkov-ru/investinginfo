from __future__ import annotations
import logging
from typing import AsyncIterator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .core.config import get_settings
from .db.session import engine
from .db.base import Base
from .routes.init import api_router

settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG))
log = logging.getLogger("startup")

async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Жизненный цикл приложения.
    В проде — только проверяем подключение.
    """
    with engine.connect() as conn:
        schema = conn.execute(text("SHOW search_path")).scalar()
        log.info(f"DB connected. search_path = {schema}")

    yield
    log.info("Server shutdown")

def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan, title="Portfolio API", version="0.1.0")

    # CORS
    allow_credentials = not ("*" in settings.ALLOWED_ORIGINS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS if settings.ALLOWED_ORIGINS else ["*"],
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    return app
