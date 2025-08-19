from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from app.backend.core.config import get_settings

settings = get_settings()

engine = create_engine(
    str(settings.DATABASE_URL),
    pool_pre_ping=True,
    future=True,
)

@event.listens_for(engine, "connect")
def _set_search_path(dbapi_connection, connection_record):
    schema = settings.DB_SCHEMA
    cur = dbapi_connection.cursor()
    cur.execute(f"SET search_path TO {schema}, public;")
    cur.close()

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
