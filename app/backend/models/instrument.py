from __future__ import annotations

from sqlalchemy import Text, CheckConstraint, CHAR, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.backend.db.base import Base

class Instrument(Base):
    __tablename__ = "instruments"

    figi: Mapped[str] = mapped_column(Text, primary_key=True)
    ticker: Mapped[str | None] = mapped_column(Text)
    # share | bond | etf | other
    class_: Mapped[str | None] = mapped_column("class", Text)
    name: Mapped[str | None] = mapped_column(Text)
    currency: Mapped[str | None] = mapped_column(CHAR(3))
    isin: Mapped[str | None] = mapped_column(Text)
    nominal: Mapped[float | None] = mapped_column(Numeric(18, 4))

    __table_args__ = (
        CheckConstraint("class in ('share','bond','etf','other')", name="instruments_class_chk"),
    )
