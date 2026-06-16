"""Admin staff toggle guards."""

import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock

from app.backend.routes.users import toggle_staff


def test_cannot_demote_last_admin():
    admin = MagicMock(id=1, is_staff=True)
    target = MagicMock(id=2, is_staff=True, email="a@test.com", full_name="Admin A", tg_username="a", created_at=None, last_login_at=None)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = target
    db.query.return_value.filter.return_value.count.return_value = 1

    payload = MagicMock(user_id=2, is_staff=False)

    with pytest.raises(HTTPException) as exc:
        toggle_staff(payload, admin, db)
    assert exc.value.status_code == 400
