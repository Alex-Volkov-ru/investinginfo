from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.backend.core.constants import ERROR_SERVICE_LOGIN_EXISTS, HTTP_409_CONFLICT
from app.backend.core.validators import validate_email
from app.backend.routes import auth as auth_routes
from app.backend.routes.auth import RegisterIn


@pytest.mark.asyncio
async def test_register_rejects_taken_service_login(monkeypatch):
    db = MagicMock()
    filtered = MagicMock()
    filtered.first.side_effect = [None, SimpleNamespace(id=77)]
    db.query.return_value.filter.return_value = filtered

    payload = RegisterIn(
        email="user@example.com",
        full_name="User Name",
        password="StrongPass1!",
        tg_username="taken_login",
        phone=None,
        tinkoff_token=None,
    )

    with pytest.raises(HTTPException) as exc:
        await auth_routes.register(payload, db=db)

    assert exc.value.status_code == HTTP_409_CONFLICT
    assert exc.value.detail == ERROR_SERVICE_LOGIN_EXISTS


def test_validate_email_normalizes_case():
    assert validate_email("TeSt.User@Example.COM") == "test.user@example.com"
