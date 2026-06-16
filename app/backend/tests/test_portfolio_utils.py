import datetime as dt
from types import SimpleNamespace

import pytest

pytest.importorskip("tinkoff")

from app.backend.api.budget_obligation_blocks import resolve_next_payment_date
from app.backend.routes.market import q2f


def test_q2f_from_units_and_nano():
    q = SimpleNamespace(units=100, nano=500_000_000)
    assert q2f(q) == 100.5


def test_q2f_none():
    assert q2f(None) == 0.0


def test_resolve_next_payment_prefers_next_payment_field():
    block = SimpleNamespace(
        next_payment=dt.date(2026, 7, 1),
        payments=[],
        start_date=None,
        due_day=15,
    )
    assert resolve_next_payment_date(block, anchor=dt.date(2026, 6, 15)) == dt.date(2026, 7, 1)
