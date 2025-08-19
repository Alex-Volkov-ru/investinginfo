from __future__ import annotations

import os
from functools import lru_cache
from pydantic import BaseModel, AnyUrl, Field
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseModel):
    # FastAPI / CORS
    DEBUG: bool = (os.getenv("DEBUG", "true").lower() == "true")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG")
    ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            o.strip() for o in (os.getenv("ALLOWED_ORIGINS") or "*").split(",")
            if o.strip()
        ]
    )

    # DB
    DATABASE_URL: AnyUrl | str = os.getenv("DATABASE_URL", "postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb")
    DB_SCHEMA: str = os.getenv("DB_SCHEMA", "pf")

    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev_secret")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # Market
    TINKOFF_TOKEN: str = os.getenv("TINKOFF_API_TOKEN") or os.getenv("TINKOFF_TOKEN") or ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Возвращает кэшированный объект настроек."""
    return Settings()
