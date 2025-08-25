from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import Column, Text, String, DateTime, Boolean, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship

from app.backend.db.base import Base


class BudgetAccount(Base):
    __tablename__ = "budget_accounts"
    __table_args__ = {"schema": "pf"}

    id = Column(sa.BigInteger, primary_key=True)
    user_id = Column(
        sa.BigInteger,
        ForeignKey("pf.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(100), nullable=False)
    currency = Column(String(3), nullable=False, server_default="RUB")
    is_savings = Column(Boolean, nullable=False, server_default=sa.text("false"))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())

    # relations
    transactions = relationship(
        "BudgetTransaction",
        back_populates="account",
        foreign_keys="BudgetTransaction.account_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    contra_transactions = relationship(
        "BudgetTransaction",
        back_populates="contra_account",
        foreign_keys="BudgetTransaction.contra_account_id",
        passive_deletes=True,
    )


class BudgetCategory(Base):
    __tablename__ = "budget_categories"
    __table_args__ = {"schema": "pf"}

    id = Column(sa.BigInteger, primary_key=True)
    user_id = Column(
        sa.BigInteger,
        ForeignKey("pf.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    kind = Column(String(10), nullable=False)          # 'income' | 'expense'
    name = Column(String(100), nullable=False)

    parent_id = Column(sa.BigInteger, ForeignKey("pf.budget_categories.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default=sa.text("true"))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())

    parent = relationship("BudgetCategory", remote_side="BudgetCategory.id")


class BudgetTransaction(Base):
    __tablename__ = "budget_transactions"
    __table_args__ = {"schema": "pf"}

    id = Column(sa.BigInteger, primary_key=True)
    user_id = Column(
        sa.BigInteger,
        ForeignKey("pf.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type = Column(String(10), nullable=False)          # 'income' | 'expense' | 'transfer'
    occurred_at = Column(DateTime(timezone=True), nullable=False)

    account_id = Column(sa.BigInteger, ForeignKey("pf.budget_accounts.id", ondelete="CASCADE"), nullable=False)
    contra_account_id = Column(sa.BigInteger, ForeignKey("pf.budget_accounts.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(sa.BigInteger, ForeignKey("pf.budget_categories.id", ondelete="SET NULL"), nullable=True)

    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(3), nullable=False, server_default="RUB")
    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())

    account = relationship("BudgetAccount", foreign_keys=[account_id], back_populates="transactions", passive_deletes=True)
    contra_account = relationship("BudgetAccount", foreign_keys=[contra_account_id], back_populates="contra_transactions", passive_deletes=True)
    category = relationship("BudgetCategory")



class BudgetObligation(Base):
    __tablename__ = "budget_obligations"
    __table_args__ = {"schema": "pf"}

    id = Column(sa.BigInteger, primary_key=True, index=True)
    user_id = Column(
        sa.BigInteger,
        ForeignKey("pf.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(Text, nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(3), nullable=False, server_default="RUB")
    is_done = Column(Boolean, nullable=False, server_default=sa.text("false"))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )

    def __repr__(self) -> str:
        return f"<BudgetObligation id={self.id} title={self.title!r} due={self.due_date} done={self.is_done}>"
