from datetime import date

from app.backend.api.budget_transactions import _dates


def test_dates_default_current_month():
    d1, d2 = _dates(None, None)
    today = date.today()
    assert d1 == today.replace(day=1)
    assert d2.month == today.month


def test_dates_explicit_range():
    d1, d2 = _dates("2026-03-01", "2026-03-31")
    assert d1 == date(2026, 3, 1)
    assert d2 == date(2026, 3, 31)
