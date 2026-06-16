from __future__ import annotations

from datetime import date, timedelta


def resolve_review_month(
    today: date,
    year: int | None = None,
    month: int | None = None,
) -> date:
    """Первый день месяца, за который строится обзор."""
    first_day_current = today.replace(day=1)

    if year is not None and month is not None:
        return date(year, month, 1)

    if today.day <= 5:
        prev = first_day_current - timedelta(days=1)
        return prev.replace(day=1)

    return first_day_current


def month_bounds(review_month: date) -> tuple[date, date]:
    """Первый и последний день месяца обзора."""
    month_start = review_month
    month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    return month_start, month_end


def upcoming_window(review_month: date, today: date, *, days_ahead: int = 7) -> tuple[date, date]:
    """
    Окно «ближайших платежей» для сводки: 7 дней от сегодня (текущий месяц)
    или от конца просматриваемого месяца (архив).
    """
    _, month_end = month_bounds(review_month)
    if review_month.year == today.year and review_month.month == today.month:
        anchor = today
    else:
        anchor = month_end
    return anchor, anchor + timedelta(days=days_ahead)
