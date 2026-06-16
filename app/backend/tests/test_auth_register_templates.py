from types import SimpleNamespace
from unittest.mock import MagicMock

from app.backend.routes.auth import _apply_auto_category_templates


def test_apply_auto_category_templates_creates_only_missing():
    import app.backend.models.portfolio  # noqa: F401 - ORM registry

    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        SimpleNamespace(kind="expense", name="Еда", monthly_limit=15000),
        SimpleNamespace(kind="expense", name="Транспорт", monthly_limit=5000),
    ]
    # First template missing, second already exists
    db.query.return_value.filter.return_value.first.side_effect = [None, SimpleNamespace(id=1)]

    created = _apply_auto_category_templates(db, user_id=42)

    assert created == 1
    assert db.add.call_count == 1
