from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
def ping() -> dict:
    """Простой healthcheck."""
    return {"status": "ok"}
