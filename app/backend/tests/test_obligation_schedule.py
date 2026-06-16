import datetime as dt
from types import SimpleNamespace

from app.backend.api.budget_obligation_blocks import resolve_next_payment_date


def test_resolve_next_payment_from_next_payment_field():
    block = SimpleNamespace(
        next_payment=dt.date(2026, 6, 20),
        payments=[],
        start_date=None,
        due_day=15,
    )
    assert resolve_next_payment_date(block, anchor=dt.date(2026, 6, 15)) == dt.date(2026, 6, 20)


def test_resolve_next_payment_from_unpaid_schedule():
    block = SimpleNamespace(
        next_payment=None,
        payments=[
            SimpleNamespace(ok=False, date=dt.date(2026, 6, 18), n=1),
            SimpleNamespace(ok=False, date=dt.date(2026, 7, 18), n=2),
        ],
        start_date=dt.date(2026, 1, 1),
        due_day=15,
    )
    assert resolve_next_payment_date(block, anchor=dt.date(2026, 6, 15)) == dt.date(2026, 6, 18)


def test_resolve_next_payment_skips_past_dates():
    block = SimpleNamespace(
        next_payment=dt.date(2026, 6, 10),
        payments=[],
        start_date=None,
        due_day=15,
    )
    assert resolve_next_payment_date(block, anchor=dt.date(2026, 6, 15)) is None


def test_generate_payment_schedule_count_and_last_remainder():
    import app.backend.models.portfolio  # noqa: F401 — ORM registry
    from app.backend.api.budget_obligation_blocks import _generate_payment_schedule

    payments = _generate_payment_schedule(
        start_date=dt.date(2026, 1, 10),
        due_day=15,
        monthly=10000.0,
        total=25000.0,
        max_count=20,
    )
    assert len(payments) == 3
    # 15.02.2026 — воскресенье, backend переносит на рабочий день
    assert payments[0].date == dt.date(2026, 2, 16)
    assert payments[0].amount == 10000.0
    assert payments[1].amount == 10000.0
    assert payments[2].amount == 5000.0
    assert all(not p.ok for p in payments)


def test_generate_payment_schedule_empty_without_start_or_monthly():
    import app.backend.models.portfolio  # noqa: F401
    from app.backend.api.budget_obligation_blocks import _generate_payment_schedule, DEFAULT_PAYMENTS_COUNT

    rows = _generate_payment_schedule(
        start_date=None,
        due_day=15,
        monthly=0,
        total=100000,
    )
    assert len(rows) == DEFAULT_PAYMENTS_COUNT
    assert all(p.amount == 0 and p.date is None for p in rows)


def test_resolve_next_payment_amount_from_schedule_row():
    import app.backend.models.portfolio  # noqa: F401
    from app.backend.api.budget_obligation_blocks import resolve_next_payment_amount

    block = SimpleNamespace(
        monthly=10000.0,
        payments=[
            SimpleNamespace(ok=True, date=dt.date(2026, 5, 15), amount=10000.0, n=1),
            SimpleNamespace(ok=False, date=dt.date(2026, 6, 15), amount=5000.0, n=2),
        ],
    )
    assert resolve_next_payment_amount(block, dt.date(2026, 6, 15)) == 5000.0
    assert resolve_next_payment_amount(block, dt.date(2026, 7, 15)) == 10000.0
