from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.backend.core.constants import (
    TRANSACTION_TYPE_EXPENSE,
    TRANSACTION_TYPE_INCOME,
    TRANSACTION_TYPE_TRANSFER,
)
from app.backend.core.security import decrypt_amount
from app.backend.models.budget import BudgetAccount, BudgetCategory, BudgetTransaction
from app.backend.models.user import User

MONTHS_RU = (
    "",
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
)

# Layout: A-D summary | E gap | F-I incomes | J gap | K-N expenses
COL_SUMMARY = 1
COL_INCOME = 6
COL_EXPENSE = 11
INCOME_SUM_COL = COL_INCOME + 3
EXPENSE_SUM_COL = COL_EXPENSE + 3

FILL_SUMMARY_HEADER = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
FILL_SUMMARY_ALT = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
FILL_INCOME_HEADER = PatternFill(start_color="70AD47", end_color="70AD47", fill_type="solid")
FILL_EXPENSE_HEADER = PatternFill(start_color="7F7F7F", end_color="7F7F7F", fill_type="solid")
FILL_INCOME_AMOUNT = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
FILL_EXPENSE_AMOUNT = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")

THIN_BORDER = Border(
    left=Side(style="thin", color="000000"),
    right=Side(style="thin", color="000000"),
    top=Side(style="thin", color="000000"),
    bottom=Side(style="thin", color="000000"),
)


def _tx_amount(tx: BudgetTransaction) -> Decimal:
    if tx.amount_encrypted:
        return decrypt_amount(tx.amount_encrypted)
    return Decimal(str(tx.amount or 0))


def _tx_date(tx: BudgetTransaction) -> date:
    occurred = tx.occurred_at
    if hasattr(occurred, "date"):
        return occurred.date()
    return occurred


def _fmt_rub(value: Decimal | float) -> str:
    amount = float(value)
    sign = "-" if amount < 0 else ""
    whole = f"{abs(int(round(amount))):,}".replace(",", " ")
    return f"р.{sign}{whole}"


def _period_title(d1: date, d2: date) -> str:
    if d1.year == d2.year and d1.month == d2.month and d1.day == 1:
        last_day = (d2.replace(day=28) + timedelta(days=4)).replace(day=1)
        month_end = last_day - timedelta(days=1)
        if d2 == month_end:
            return MONTHS_RU[d1.month]
    return f"{d1.strftime('%d.%m.%Y')} — {d2.strftime('%d.%m.%Y')}"


def _apply_tx_to_balances(balances: dict[int, Decimal], tx: BudgetTransaction, amount: Decimal) -> None:
    if tx.type == TRANSACTION_TYPE_INCOME:
        if tx.account_id:
            balances[tx.account_id] += amount
    elif tx.type == TRANSACTION_TYPE_EXPENSE:
        if tx.account_id:
            balances[tx.account_id] -= amount
    elif tx.type == TRANSACTION_TYPE_TRANSFER:
        if tx.account_id:
            balances[tx.account_id] -= amount
        if tx.contra_account_id:
            balances[tx.contra_account_id] += amount


def _split_balance_totals(accounts: list[BudgetAccount], balances: dict[int, Decimal]) -> tuple[Decimal, Decimal]:
    regular = Decimal("0")
    savings = Decimal("0")
    for acc in accounts:
        value = balances.get(acc.id, Decimal("0"))
        if acc.is_savings:
            savings += value
        else:
            regular += value
    return regular, savings


def _write_money_cell(ws, row: int, col: int, value: Decimal, *, fill: PatternFill | None = None, bold: bool = False) -> None:
    cell = ws.cell(row=row, column=col, value=float(value))
    cell.number_format = '#,##0" ₽"'
    cell.alignment = Alignment(horizontal="right", vertical="center")
    if fill:
        cell.fill = fill
    if bold:
        cell.font = Font(bold=True)
    cell.border = THIN_BORDER


def build_budget_excel_bytes(
    db: Session,
    user: User,
    d1: date,
    d2: date,
) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Бюджет"

    accounts = list(
        db.scalars(select(BudgetAccount).where(BudgetAccount.user_id == user.id).order_by(BudgetAccount.id.asc())).all()
    )
    category_map = {
        c.id: c for c in db.scalars(select(BudgetCategory).where(BudgetCategory.user_id == user.id)).all()
    }

    period_txs = list(
        db.scalars(
            select(BudgetTransaction)
            .where(
                BudgetTransaction.user_id == user.id,
                BudgetTransaction.occurred_at >= d1,
                BudgetTransaction.occurred_at <= d2,
            )
            .order_by(BudgetTransaction.occurred_at.asc(), BudgetTransaction.id.asc())
        ).all()
    )

    history_txs = list(
        db.scalars(
            select(BudgetTransaction)
            .where(
                BudgetTransaction.user_id == user.id,
                BudgetTransaction.occurred_at <= d2,
            )
            .order_by(BudgetTransaction.occurred_at.asc(), BudgetTransaction.id.asc())
        ).all()
    )

    start_balances: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    end_balances: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for tx in history_txs:
        amount = _tx_amount(tx)
        tx_day = _tx_date(tx)
        _apply_tx_to_balances(end_balances, tx, amount)
        if tx_day < d1:
            _apply_tx_to_balances(start_balances, tx, amount)

    start_regular, start_savings = _split_balance_totals(accounts, start_balances)
    end_regular, end_savings = _split_balance_totals(accounts, end_balances)

    income_txs = [tx for tx in period_txs if tx.type == TRANSACTION_TYPE_INCOME]
    expense_txs = [tx for tx in period_txs if tx.type == TRANSACTION_TYPE_EXPENSE]

    income_total = sum((_tx_amount(tx) for tx in income_txs), Decimal("0"))
    expense_total = sum((_tx_amount(tx) for tx in expense_txs), Decimal("0"))
    savings_delta = Decimal("0")
    for tx in period_txs:
        amount = _tx_amount(tx)
        if tx.type == TRANSACTION_TYPE_INCOME:
            acc = db.get(BudgetAccount, tx.account_id) if tx.account_id else None
            if acc and acc.is_savings:
                savings_delta += amount
        elif tx.type == TRANSACTION_TYPE_EXPENSE:
            acc = db.get(BudgetAccount, tx.account_id) if tx.account_id else None
            if acc and acc.is_savings:
                savings_delta -= amount
        elif tx.type == TRANSACTION_TYPE_TRANSFER:
            acc_to = db.get(BudgetAccount, tx.contra_account_id) if tx.contra_account_id else None
            acc_from = db.get(BudgetAccount, tx.account_id) if tx.account_id else None
            if acc_to and acc_to.is_savings:
                savings_delta += amount
            elif acc_from and acc_from.is_savings:
                savings_delta -= amount

    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 14
    ws.column_dimensions["D"].width = 14
    ws.column_dimensions["E"].width = 2
    for col in (COL_INCOME, COL_INCOME + 1, COL_INCOME + 2, INCOME_SUM_COL):
        ws.column_dimensions[get_column_letter(col)].width = 16
    ws.column_dimensions["J"].width = 2
    for col in (COL_EXPENSE, COL_EXPENSE + 1, COL_EXPENSE + 2, EXPENSE_SUM_COL):
        ws.column_dimensions[get_column_letter(col)].width = 16

    title = _period_title(d1, d2)
    ws.merge_cells(start_row=1, start_column=COL_SUMMARY, end_row=1, end_column=COL_SUMMARY + 3)
    title_cell = ws.cell(row=1, column=COL_SUMMARY, value=title)
    title_cell.font = Font(size=20, bold=True, color="1F4E78")
    title_cell.alignment = Alignment(horizontal="left", vertical="center")

    ws.merge_cells(start_row=2, start_column=COL_SUMMARY, end_row=2, end_column=COL_SUMMARY + 3)
    subtitle = ws.cell(row=2, column=COL_SUMMARY, value=f"{d1.strftime('%d.%m.%Y')} — {d2.strftime('%d.%m.%Y')}")
    subtitle.font = Font(size=10, color="6B7280")
    subtitle.alignment = Alignment(horizontal="left", vertical="center")

    summary_header_row = 4
    for idx, label in enumerate(("", "Счета", "Сбережения", "Итого"), start=COL_SUMMARY):
        cell = ws.cell(row=summary_header_row, column=idx, value=label)
        cell.fill = FILL_SUMMARY_HEADER
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = THIN_BORDER

    summary_rows = [
        ("Остаток на начало периода", start_regular, start_savings),
        ("Остаток на конец периода", end_regular, end_savings),
        ("Сбережения (изменение)", None, savings_delta),
        ("Доходов за период", income_total, None),
        ("Расходов за период", expense_total, None),
        ("Разница", income_total - expense_total, None),
    ]

    for offset, row_data in enumerate(summary_rows, start=1):
        row = summary_header_row + offset
        label, col_b, col_c = row_data
        label_cell = ws.cell(row=row, column=COL_SUMMARY, value=label)
        label_cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        label_cell.border = THIN_BORDER
        if offset % 2 == 0:
            label_cell.fill = FILL_SUMMARY_ALT

        if col_b is not None and col_c is not None:
            _write_money_cell(ws, row, COL_SUMMARY + 1, col_b)
            _write_money_cell(ws, row, COL_SUMMARY + 2, col_c)
            _write_money_cell(ws, row, COL_SUMMARY + 3, col_b + col_c, bold=label == "Разница")
        elif col_b is not None:
            ws.cell(row=row, column=COL_SUMMARY + 1).border = THIN_BORDER
            ws.cell(row=row, column=COL_SUMMARY + 2).border = THIN_BORDER
            _write_money_cell(ws, row, COL_SUMMARY + 3, col_b, bold=label == "Разница")
        else:
            ws.cell(row=row, column=COL_SUMMARY + 1).border = THIN_BORDER
            _write_money_cell(ws, row, COL_SUMMARY + 2, col_c)
            ws.cell(row=row, column=COL_SUMMARY + 3).border = THIN_BORDER

    section_row = 7
    data_row = 9

    for col_start, title_text, total, header_fill, columns in (
        (
            COL_INCOME,
            "Доходы",
            income_total,
            FILL_INCOME_HEADER,
            ("Дата", "Источник", "Категория", "Сумма"),
        ),
        (
            COL_EXPENSE,
            "Расходы",
            expense_total,
            FILL_EXPENSE_HEADER,
            ("Дата", "Назначение", "Категория", "Сумма"),
        ),
    ):
        for col in range(col_start, col_start + 3):
            cell = ws.cell(row=section_row, column=col)
            cell.fill = header_fill
            cell.border = THIN_BORDER
        title_cell = ws.cell(row=section_row, column=col_start, value=title_text)
        title_cell.fill = header_fill
        title_cell.font = Font(bold=True, color="FFFFFF", size=12)
        title_cell.alignment = Alignment(horizontal="left", vertical="center")
        title_cell.border = THIN_BORDER

        total_cell = ws.cell(row=section_row, column=col_start + 3, value=f"Итого: {_fmt_rub(total)}")
        total_cell.fill = header_fill
        total_cell.font = Font(bold=True, color="FFFFFF", size=11)
        total_cell.alignment = Alignment(horizontal="right", vertical="center")
        total_cell.border = THIN_BORDER

        header_row = section_row + 1
        for idx, column_title in enumerate(columns):
            cell = ws.cell(row=header_row, column=col_start + idx, value=column_title)
            cell.fill = header_fill
            cell.font = Font(bold=True, color="FFFFFF")
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = THIN_BORDER

    income_row = data_row
    for tx in income_txs:
        category_name = category_map[tx.category_id].name if tx.category_id and tx.category_id in category_map else "—"
        ws.cell(row=income_row, column=COL_INCOME, value=_tx_date(tx).strftime("%d.%m.%Y")).border = THIN_BORDER
        ws.cell(row=income_row, column=COL_INCOME + 1, value=tx.description or "—").border = THIN_BORDER
        ws.cell(row=income_row, column=COL_INCOME + 2, value=category_name).border = THIN_BORDER
        _write_money_cell(ws, income_row, INCOME_SUM_COL, _tx_amount(tx), fill=FILL_INCOME_AMOUNT)
        income_row += 1

    expense_row = data_row
    for tx in expense_txs:
        category_name = category_map[tx.category_id].name if tx.category_id and tx.category_id in category_map else "—"
        ws.cell(row=expense_row, column=COL_EXPENSE, value=_tx_date(tx).strftime("%d.%m.%Y")).border = THIN_BORDER
        ws.cell(row=expense_row, column=COL_EXPENSE + 1, value=tx.description or "—").border = THIN_BORDER
        ws.cell(row=expense_row, column=COL_EXPENSE + 2, value=category_name).border = THIN_BORDER
        _write_money_cell(ws, expense_row, EXPENSE_SUM_COL, _tx_amount(tx), fill=FILL_EXPENSE_AMOUNT)
        expense_row += 1

    if income_row > data_row:
        income_range = (
            f"{get_column_letter(INCOME_SUM_COL)}{data_row}:"
            f"{get_column_letter(INCOME_SUM_COL)}{income_row - 1}"
        )
        ws.conditional_formatting.add(
            income_range,
            ColorScaleRule(
                start_type="min",
                start_color="FFFFFF",
                end_type="max",
                end_color="63BE7B",
            ),
        )

    if expense_row > data_row:
        expense_range = (
            f"{get_column_letter(EXPENSE_SUM_COL)}{data_row}:"
            f"{get_column_letter(EXPENSE_SUM_COL)}{expense_row - 1}"
        )
        ws.conditional_formatting.add(
            expense_range,
            ColorScaleRule(
                start_type="min",
                start_color="63BE7B",
                mid_type="percentile",
                mid_value=50,
                mid_color="FFEB84",
                end_type="max",
                end_color="F8696B",
            ),
        )

    if income_row == data_row:
        ws.cell(row=data_row, column=COL_INCOME, value="Нет доходов за период")
        ws.merge_cells(start_row=data_row, start_column=COL_INCOME, end_row=data_row, end_column=INCOME_SUM_COL)
    if expense_row == data_row:
        ws.cell(row=data_row, column=COL_EXPENSE, value="Нет расходов за период")
        ws.merge_cells(start_row=data_row, start_column=COL_EXPENSE, end_row=data_row, end_column=EXPENSE_SUM_COL)

    ws.freeze_panes = f"{get_column_letter(COL_INCOME)}{data_row}"
    ws.sheet_view.showGridLines = True

    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.read()
