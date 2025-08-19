from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData
from app.backend.core.config import get_settings

_settings = get_settings()
metadata_obj = MetaData(schema=_settings.DB_SCHEMA)

class Base(DeclarativeBase):
    """Базовая модель SQLAlchemy с предустановленной схемой."""
    metadata = metadata_obj
