from typing import List
from pydantic import AnyUrl
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Глобальные настройки приложения, читаются из .env.
    """
    DB_SCHEMA: str = "public"
    
    # --- DB ---
    DATABASE_URL: AnyUrl  # postgresql+psycopg2://user:pass@host:5432/dbname

    # --- Tinkoff API ---
    TINKOFF_API_TOKEN: str | None = None
    TINKOFF_TOKEN: str | None = None  # fallback

    # --- CORS ---
    ALLOWED_ORIGINS: str = "http://localhost:8080,http://127.0.0.1:8080"

    # --- App ---
    BACKEND_PORT: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()


def allowed_origins_list() -> List[str]:
    """
    Преобразует строку ALLOWED_ORIGINS в список доменов.
    """
    return [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
