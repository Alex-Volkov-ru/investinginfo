from __future__ import annotations

from datetime import date
from decimal import Decimal
from io import BytesIO
from typing import Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.backend.core.security import decrypt_amount
from app.backend.models.budget import BudgetCategory, BudgetTransaction
from app.backend.models.user import User

TYPE_LABELS = {
    "income": "Доход",
    "expense": "Расход",
    "transfer": "Перевод",
}


def _tx_amount(tx: BudgetTransaction) -> Decimal:
    if tx.amount_encrypted:
        return decrypt_amount(tx.amount_encrypted)
    return Decimal(str(tx.amount or 0))


def _autosize_columns(ws, widths: dict[int, int] | None = None) -> None:
    widths = widths or {}
    for idx, col in enumerate(ws.columns, start=1):
        if idx in widths:
            ws.column_dimensions[get_column_letter(idx)].width = widths[idx]
            continue
        max_len = 0
        for cell in col:
            value = "" if cell.value is None else str(cell.value)
            max_len = max(max_len, len(value))
        ws.column_dimensions[get_column_letter(idx)].width = min(max(max_len + 2, 12), 42)


def _apply_table_header(ws, row: int, columns: Iterable[str]) -> None:
    fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    font = Font(color="FFFFFF", bold=True)
    border = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9"),
    )
    for idx, title in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=idx, value=title)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border


def _apply_row_borders(ws, row: int, columns_count: int) -> None:
    border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB"),
    )
    for col in range(1, columns_count + 1):
        ws.cell(row=row, column=col).border = border


def build_budget_excel_bytes(
    db: Session,
    user: User,
    d1: date,
    d2: date,
) -> bytes:
    wb = Workbook()
    ws_summary = wb.active
    ws_summary.title = "Сводка"
    ws_tx = wb.create_sheet("Операции")
    ws_cat = wb.create_sheet("Категории")

    txs = db.scalars(
        select(BudgetTransaction).where(
            BudgetTransaction.user_id == user.id,
            BudgetTransaction.occurred_at >= d1,
            BudgetTransaction.occurred_at <= d2,
        ).order_by(BudgetTransaction.occurred_at.asc(), BudgetTransaction.id.asc())
    ).all()

    category_map = {c.id: c for c in db.scalars(select(BudgetCategory).where(BudgetCategory.user_id == user.id)).all()}

    income_total = Decimal("0")
    expense_total = Decimal("0")
    transfer_total = Decimal("0")
    by_category: dict[tuple[str, str], Decimal] = {}

    # Sheet 1: Summary
    ws_summary["A1"] = "Отчет по бюджету"
    ws_summary["A1"].font = Font(size=16, bold=True, color="1F2937")
    ws_summary["A2"] = f"Пользователь: {user.full_name or user.tg_username or user.email}"
    ws_summary["A3"] = f"Email: {user.email}"
    ws_summary["A4"] = f"Период: {d1.strftime('%d.%m.%Y')} - {d2.strftime('%d.%m.%Y')}"

    _apply_table_header(ws_summary, 6, ["Показатель", "Значение"])
    summary_rows = [
        ("Доходы", income_total),
        ("Расходы", expense_total),
        ("Переводы", transfer_total),
        ("Итог (доходы - расходы)", income_total - expense_total),
    ]

    # Sheet 2: Transactions
    tx_columns = ["Дата", "Тип", "Сумма", "Валюта", "Счет", "Категория", "Описание"]
    _apply_table_header(ws_tx, 1, tx_columns)
    tx_row = 2

    for tx in txs:
        amount = _tx_amount(tx)
        if tx.type == "income":
            income_total += amount
        elif tx.type == "expense":
            expense_total += amount
        elif tx.type == "transfer":
            transfer_total += amount

        category_name = "-"
        if tx.category_id and tx.category_id in category_map:
            category_name = category_map[tx.category_id].name
            key = (tx.type, category_name)
            by_category[key] = by_category.get(key, Decimal("0")) + amount

        ws_tx.cell(row=tx_row, column=1, value=tx.occurred_at.strftime("%d.%m.%Y"))
        ws_tx.cell(row=tx_row, column=2, value=TYPE_LABELS.get(tx.type, tx.type))
        amount_cell = ws_tx.cell(row=tx_row, column=3, value=float(amount))
        amount_cell.number_format = "#,##0.00"
        ws_tx.cell(row=tx_row, column=4, value=tx.currency)
        ws_tx.cell(row=tx_row, column=5, value=tx.account.title if tx.account else "-")
        ws_tx.cell(row=tx_row, column=6, value=category_name)
        ws_tx.cell(row=tx_row, column=7, value=tx.description or "-")
        _apply_row_borders(ws_tx, tx_row, len(tx_columns))
        tx_row += 1

    # Fill summary values after totals calculated
    for idx, (label, value) in enumerate(summary_rows, start=7):
        if label == "Доходы":
            value = income_total
        elif label == "Расходы":
            value = expense_total
        elif label == "Переводы":
            value = transfer_total
        elif label == "Итог (доходы - расходы)":
            value = income_total - expense_total
        ws_summary.cell(row=idx, column=1, value=label)
        v_cell = ws_summary.cell(row=idx, column=2, value=float(value))
        v_cell.number_format = "#,##0.00"
        _apply_row_borders(ws_summary, idx, 2)

    # Sheet 3: Category aggregates
    cat_columns = ["Тип", "Категория", "Сумма"]
    _apply_table_header(ws_cat, 1, cat_columns)
    cat_row = 2
    for (kind, name), value in sorted(by_category.items(), key=lambda item: (item[0][0], item[0][1])):
        ws_cat.cell(row=cat_row, column=1, value=TYPE_LABELS.get(kind, kind))
        ws_cat.cell(row=cat_row, column=2, value=name)
        c = ws_cat.cell(row=cat_row, column=3, value=float(value))
        c.number_format = "#,##0.00"
        _apply_row_borders(ws_cat, cat_row, 3)
        cat_row += 1

    if cat_row == 2:
        ws_cat.cell(row=2, column=1, value="Нет данных за период")

    # Common formatting
    for ws in (ws_summary, ws_tx, ws_cat):
        ws.freeze_panes = "A2"

    _autosize_columns(ws_summary, {1: 40, 2: 24})
    _autosize_columns(ws_tx, {1: 14, 2: 12, 3: 16, 4: 10, 5: 24, 6: 24, 7: 44})
    _autosize_columns(ws_cat, {1: 12, 2: 28, 3: 16})

    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.read()
