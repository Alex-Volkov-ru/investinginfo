from __future__ import annotations

import os
from functools import lru_cache
from pydantic import BaseModel, AnyUrl, Field
from dotenv import load_dotenv

load_dotenv()

# TODO Поправить секреты до конца
class Settings(BaseModel):
    # --- SQLAlchemy pool ---
    SQL_POOL_SIZE: int = int(os.getenv("SQL_POOL_SIZE", "5"))
    SQL_MAX_OVERFLOW: int = int(os.getenv("SQL_MAX_OVERFLOW", "10"))
    SQL_POOL_RECYCLE: int = int(os.getenv("SQL_POOL_RECYCLE", "1800"))  # 30 мин
    SQL_POOL_TIMEOUT: int = int(os.getenv("SQL_POOL_TIMEOUT", "30"))

    # --- App logging/CORS ---
    DEBUG: bool = (os.getenv("DEBUG", "true").lower() == "true")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG")
    ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            o.strip() for o in (os.getenv("ALLOWED_ORIGINS") or "*").split(",")
            if o.strip()
        ]
    )

    # --- DB ---
    # TODO Поправить секреты до конца
    DATABASE_URL: AnyUrl | str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb",
    )
    DB_SCHEMA: str = os.getenv("DB_SCHEMA", "pf")

    # --- Auth/JWT ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev_secret")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # --- Market ---
    TINKOFF_TOKEN: str = os.getenv("TINKOFF_API_TOKEN") or os.getenv("TINKOFF_TOKEN") or ""

    # --- Redis ---
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://bigs-redis:6379/0")

    # --- Backups ---
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "/opt/backups")
    BACKUP_RETENTION_DAYS: int = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
