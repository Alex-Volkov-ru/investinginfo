"""Whiteboard export preview logic (mirrors frontend summarizeExportItems)."""

from app.backend.core.constants import TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_EXPENSE


def _summarize_export_items(items: list[dict]) -> dict:
    income_count = expense_count = ready_count = 0
    skipped_no_category = skipped_zero = 0
    income_total = expense_total = 0.0

    for raw in items or []:
        kind = raw.get("kind", "expense")
        if kind not in (TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_EXPENSE):
            continue
        amount = float(raw.get("amount") or 0)
        if kind == TRANSACTION_TYPE_INCOME:
            income_count += 1
            income_total += amount
        else:
            expense_count += 1
            expense_total += amount
        if amount <= 0:
            skipped_zero += 1
            continue
        if not raw.get("category_id"):
            skipped_no_category += 1
            continue
        ready_count += 1

    return {
        "ready_count": ready_count,
        "skipped_no_category": skipped_no_category,
        "income_count": income_count,
        "expense_count": expense_count,
    }


def test_summarize_export_ready_and_skipped():
    items = [
        {"kind": "expense", "amount": 100, "category_id": 1, "title": "Еда"},
        {"kind": "expense", "amount": 50, "title": "Без категории"},
        {"kind": "income", "amount": 0, "category_id": 2, "title": "Ноль"},
        {"kind": "budget", "amount": 10000},
    ]
    r = _summarize_export_items(items)
    assert r["ready_count"] == 1
    assert r["skipped_no_category"] == 1
    assert r["income_count"] == 1
    assert r["expense_count"] == 2
