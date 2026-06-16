from datetime import date

from app.backend.api.monthly_review_utils import (
    month_bounds,
    resolve_review_month,
    upcoming_window,
)


def test_resolve_review_month_explicit():
    assert resolve_review_month(date(2026, 6, 15), 2025, 3) == date(2025, 3, 1)


def test_resolve_review_month_early_month_defaults_to_previous():
    assert resolve_review_month(date(2026, 6, 3)) == date(2026, 5, 1)


def test_resolve_review_month_mid_month_defaults_to_current():
    assert resolve_review_month(date(2026, 6, 15)) == date(2026, 6, 1)


def test_month_bounds_june():
    start, end = month_bounds(date(2026, 6, 1))
    assert start == date(2026, 6, 1)
    assert end == date(2026, 6, 30)


def test_upcoming_window_current_month_from_today():
    today = date(2026, 6, 15)
    start, end = upcoming_window(date(2026, 6, 1), today)
    assert start == today
    assert end == date(2026, 6, 22)


def test_upcoming_window_past_month_from_month_end():
    today = date(2026, 6, 15)
    start, end = upcoming_window(date(2026, 4, 1), today)
    assert start == date(2026, 4, 30)
    assert end == date(2026, 5, 7)
