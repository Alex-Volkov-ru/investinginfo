from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.backend.core.config import get_settings

s = get_settings()

engine = create_engine(
    s.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=s.SQL_POOL_RECYCLE,
    pool_size=s.SQL_POOL_SIZE,
    max_overflow=s.SQL_MAX_OVERFLOW,
    pool_timeout=s.SQL_POOL_TIMEOUT,
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
