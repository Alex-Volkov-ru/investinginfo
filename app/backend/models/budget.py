from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    DateTime, Text, String, Boolean, ForeignKey, Numeric, CheckConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.backend.db.base import Base


# ============ Accounts ============

class BudgetAccount(Base):
    __tablename__ = "budget_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ВАЖНО: две раздельные связи
    transactions_out: Mapped[list["BudgetTransaction"]] = relationship(
        "BudgetTransaction",
        back_populates="account",
        foreign_keys="BudgetTransaction.account_id",
        cascade="all, delete-orphan",
    )
    transactions_in: Mapped[list["BudgetTransaction"]] = relationship(
        "BudgetTransaction",
        back_populates="contra_account",
        foreign_keys="BudgetTransaction.contra_account_id",
    )


# ============ Categories ============

class BudgetCategory(Base):
    __tablename__ = "budget_categories"
    __table_args__ = (
        CheckConstraint("kind IN ('income','expense')", name="budget_categories_kind_chk"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(7))  # 'income' | 'expense'
    name: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("budget_categories.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    parent: Mapped[Optional["BudgetCategory"]] = relationship(remote_side="BudgetCategory.id")

    transactions: Mapped[list["BudgetTransaction"]] = relationship(
        "BudgetTransaction", back_populates="category"
    )


# ============ Transactions ============

class BudgetTransaction(Base):
    __tablename__ = "budget_transactions"
    __table_args__ = (
        CheckConstraint("type IN ('income','expense','transfer')", name="budget_transactions_type_chk"),
        CheckConstraint("amount >= 0", name="budget_transactions_amount_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    account_id: Mapped[int] = mapped_column(ForeignKey("budget_accounts.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("budget_categories.id", ondelete="SET NULL"), index=True)

    type: Mapped[str] = mapped_column(String(8))   # income | expense | transfer
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # для transfer
    contra_account_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("budget_accounts.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # связи (явно указываем foreign_keys!)
    account: Mapped["BudgetAccount"] = relationship(
        "BudgetAccount",
        foreign_keys=[account_id],
        back_populates="transactions_out",
    )
    contra_account: Mapped[Optional["BudgetAccount"]] = relationship(
        "BudgetAccount",
        foreign_keys=[contra_account_id],
        back_populates="transactions_in",
    )
    category: Mapped[Optional["BudgetCategory"]] = relationship(
        "BudgetCategory", back_populates="transactions"
    )
