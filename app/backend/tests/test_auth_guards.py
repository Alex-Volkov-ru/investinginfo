from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.backend.core.auth import create_access_token, get_current_user, get_staff_user


def _db_with_user(user):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = user
    return db


def test_get_current_user_from_valid_token():
    user = SimpleNamespace(id=7, is_staff=False)
    token = create_access_token(user_id=7, expires_minutes=5)
    creds = SimpleNamespace(credentials=token)
    db = _db_with_user(user)

    resolved = get_current_user(creds, db)
    assert resolved.id == 7


def test_get_current_user_invalid_token_raises_401():
    creds = SimpleNamespace(credentials="broken.token")
    db = _db_with_user(None)

    with pytest.raises(HTTPException) as exc:
        get_current_user(creds, db)
    assert exc.value.status_code == 401


def test_get_current_user_missing_user_raises_401():
    token = create_access_token(user_id=999, expires_minutes=5)
    creds = SimpleNamespace(credentials=token)
    db = _db_with_user(None)

    with pytest.raises(HTTPException) as exc:
        get_current_user(creds, db)
    assert exc.value.status_code == 401


def test_get_staff_user_forbidden_for_non_staff():
    user = SimpleNamespace(id=1, is_staff=False)
    with pytest.raises(HTTPException) as exc:
        get_staff_user(user)
    assert exc.value.status_code == 403


def test_get_staff_user_allows_staff():
    user = SimpleNamespace(id=2, is_staff=True)
    assert get_staff_user(user) is user
