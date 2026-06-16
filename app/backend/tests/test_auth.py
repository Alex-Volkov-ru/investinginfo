"""JWT helpers — unit tests without DB."""

from datetime import datetime, timezone

from jose import jwt

from app.backend.core.auth import create_access_token, create_impersonation_token
from app.backend.core.config import get_settings


def test_create_access_token_roundtrip():
    settings = get_settings()
    token = create_access_token(42, expires_minutes=5)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "42"
    assert payload["exp"] > datetime.now(timezone.utc).timestamp()


def test_impersonation_token_has_admin_marker():
    settings = get_settings()
    token = create_impersonation_token(target_user_id=7, admin_id=1)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "7"
    assert payload["imp_by"] == 1
