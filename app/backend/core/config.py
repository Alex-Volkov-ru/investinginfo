from __future__ import annotations

import os
from functools import lru_cache
from pydantic import BaseModel, AnyUrl, Field, model_validator
from dotenv import load_dotenv

load_dotenv()

_DEV_SECRET_KEY = "dev_secret"
_DEV_DATABASE_URL = "postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb"


class Settings(BaseModel):
    # --- SQLAlchemy pool ---
    SQL_POOL_SIZE: int = int(os.getenv("SQL_POOL_SIZE", "5"))
    SQL_MAX_OVERFLOW: int = int(os.getenv("SQL_MAX_OVERFLOW", "10"))
    SQL_POOL_RECYCLE: int = int(os.getenv("SQL_POOL_RECYCLE", "1800"))  # 30 мин
    SQL_POOL_TIMEOUT: int = int(os.getenv("SQL_POOL_TIMEOUT", "30"))

    # --- App logging/CORS ---
    DEBUG: bool = (os.getenv("DEBUG", "false").lower() == "true")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            o.strip() for o in (os.getenv("ALLOWED_ORIGINS") or "*").split(",")
            if o.strip()
        ]
    )

    # --- DB ---
    DATABASE_URL: AnyUrl | str = os.getenv(
        "DATABASE_URL",
        _DEV_DATABASE_URL,
    )
    DB_SCHEMA: str = os.getenv("DB_SCHEMA", "pf")

    # --- Auth/JWT ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", _DEV_SECRET_KEY)
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    # Fernet key (url-safe base64, 44 chars). If empty, derived from SECRET_KEY for backward compat.
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    # --- Market ---
    TINKOFF_TOKEN: str = os.getenv("TINKOFF_API_TOKEN") or os.getenv("TINKOFF_TOKEN") or ""

    # --- Redis ---
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://bigs-redis:6379/0")

    # --- Backups ---
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "/opt/backups")
    BACKUP_RETENTION_DAYS: int = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))

    @model_validator(mode="after")
    def validate_production_config(self) -> "Settings":
        env = (os.getenv("ENVIRONMENT") or os.getenv("ENV") or "development").lower()
        if env not in ("production", "prod"):
            return self
        if self.SECRET_KEY == _DEV_SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be a strong random value (32+ chars) in production")
        if str(self.DATABASE_URL) == _DEV_DATABASE_URL:
            raise ValueError("DATABASE_URL must not use development defaults in production")
        if self.DEBUG:
            raise ValueError("DEBUG must be false in production")
        if "*" in self.ALLOWED_ORIGINS:
            raise ValueError("ALLOWED_ORIGINS must list explicit domains in production")
        return self

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
