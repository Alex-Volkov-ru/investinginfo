"""Presence WebSocket token parsing."""

from unittest.mock import MagicMock

from jose import jwt

from app.backend.api.presence import _user_from_token
from app.backend.core.auth import create_access_token
from app.backend.core.config import get_settings


def test_user_from_token_valid():
    settings = get_settings()
    token = create_access_token(5)
    user = MagicMock(id=5, email="u@test.com")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = user
    assert _user_from_token(token, db) is user


def test_user_from_token_invalid_jwt():
    db = MagicMock()
    assert _user_from_token("not-a-jwt", db) is None


def test_user_from_token_missing_user():
    token = create_access_token(999)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    assert _user_from_token(token, db) is None
