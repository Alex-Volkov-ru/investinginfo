from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import Column, Text, String, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB

from app.backend.db.base import Base


class Whiteboard(Base):
    __tablename__ = "whiteboards"
    __table_args__ = {"schema": "pf"}

    id = Column(sa.BigInteger, primary_key=True)
    user_id = Column(
        sa.BigInteger,
        ForeignKey("pf.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(200), nullable=False)
    budget = Column(Numeric(20, 2), nullable=False, server_default="0")
    items = Column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    canvas_data = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )

    def __repr__(self) -> str:
        return f"<Whiteboard id={self.id} name={self.name!r} user_id={self.user_id}>"
