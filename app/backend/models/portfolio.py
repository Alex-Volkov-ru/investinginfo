from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Text, CHAR, Numeric, SmallInteger, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.backend.db.base import Base

# --- Portfolios (кошельки) ---

class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, default="broker")    # broker/bank/crypto
    currency: Mapped[str] = mapped_column(CHAR(3), default="RUB")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="portfolios")
    positions: Mapped[list["Position"]] = relationship(back_populates="portfolio", cascade="all,delete-orphan")
    trades: Mapped[list["Trade"]] = relationship(back_populates="portfolio", cascade="all,delete-orphan")


# --- Positions (агрегированная позиция) ---

class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    figi: Mapped[str] = mapped_column(ForeignKey("instruments.figi", onupdate="CASCADE"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(20, 6), default=0)
    avg_price: Mapped[float] = mapped_column(Numeric(20, 6), default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="positions")

Index("positions_portfolio_idx", Position.portfolio_id)
Index("positions_figi_idx", Position.figi)


# --- Trades (история сделок) ---

class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    figi: Mapped[str] = mapped_column(ForeignKey("instruments.figi"), nullable=False)
    side: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # -1 sell, 1 buy
    quantity: Mapped[float] = mapped_column(Numeric(20, 6), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(20, 6), nullable=False)
    fee: Mapped[float] = mapped_column(Numeric(20, 6), default=0)
    trade_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    source: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="trades")

Index("trades_portfolio_idx", Trade.portfolio_id)
Index("trades_figi_idx",      Trade.figi)
Index("trades_dt_idx",        Trade.trade_at)
