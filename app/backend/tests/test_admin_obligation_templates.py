from types import SimpleNamespace
from unittest.mock import MagicMock
from unittest.mock import patch

import pytest

pytest.importorskip("tinkoff")

from app.backend.api.admin import apply_obligation_template, apply_all_obligation_templates_to_user


def _template():
    return SimpleNamespace(
        title="Ипотека",
        total=3_000_000,
        monthly=45_000,
        rate=12.5,
        due_day=15,
        notes="",
    )


def test_apply_obligation_template_returns_existing_block_without_duplicate():
    db = MagicMock()
    admin = SimpleNamespace(id=1, is_staff=True)
    user = SimpleNamespace(id=42)
    existing_block = SimpleNamespace(id=777)

    db.get.return_value = _template()
    db.query.return_value.filter.return_value.first.side_effect = [user, existing_block]

    result = apply_obligation_template(1, 42, admin, db)

    assert result == {"block_id": 777, "created": False}
    db.add.assert_not_called()


def test_apply_obligation_template_creates_new_block_when_missing():
    import app.backend.models.portfolio  # noqa: F401 - ORM registry

    db = MagicMock()
    admin = SimpleNamespace(id=1, is_staff=True)
    user = SimpleNamespace(id=42)

    db.get.return_value = _template()
    db.query.return_value.filter.return_value.first.side_effect = [user, None]

    created_block = SimpleNamespace(id=999)
    db.refresh.side_effect = lambda obj: setattr(obj, "id", created_block.id)

    result = apply_obligation_template(1, 42, admin, db)

    assert result == {"block_id": 999, "created": True}
    assert db.add.call_count == 1


def test_apply_all_obligation_templates_counts_created_and_reused():
    db = MagicMock()
    admin = SimpleNamespace(id=1, is_staff=True)
    user = SimpleNamespace(id=42)
    t1 = _template()
    t2 = _template()
    t2.title = "Авто"
    db.query.return_value.order_by.return_value.all.return_value = [t1, t2]
    db.query.return_value.filter.return_value.first.return_value = user

    with patch("app.backend.api.admin._apply_obligation_template_to_user") as apply_mock:
        apply_mock.side_effect = [(501, True), (77, False)]
        result = apply_all_obligation_templates_to_user(42, admin, db)

    assert result == {"created": 1, "reused": 1}
