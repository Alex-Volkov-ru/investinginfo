import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock

from app.backend.routes.portfolio import _ensure_portfolio_of_user


def test_ensure_portfolio_denies_other_user():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(HTTPException) as exc:
        _ensure_portfolio_of_user(db, portfolio_id=99, user_id=1)
    assert exc.value.status_code == 403


def test_ensure_portfolio_allows_owner():
    db = MagicMock()
    pf = MagicMock(id=99)
    db.query.return_value.filter.return_value.first.return_value = pf
    result = _ensure_portfolio_of_user(db, portfolio_id=99, user_id=1)
    assert result is pf
