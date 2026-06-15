from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import Column, Text, String, DateTime, Boolean, ForeignKey, Numeric, Integer
from sqlalchemy.dialects.postgresql import JSONB

from app.backend.db.base import Base


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"
    __table_args__ = {"schema": "pf"}

    id = Column(sa.BigInteger, primary_key=True)
    admin_id = Column(sa.BigInteger, ForeignKey("pf.users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    target_user_id = Column(sa.BigInteger, ForeignKey("pf.users.id", ondelete="SET NULL"), nullable=True)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())


class AdminCategoryTemplate(Base):
    __tablename__ = "admin_category_templates"
    __table_args__ = {"schema": "pf"}

    id = Column(sa.BigInteger, primary_key=True)
    kind = Column(String(10), nullable=False)
    name = Column(String(100), nullable=False)
    monthly_limit = Column(Numeric(20, 2), nullable=True)
    apply_to_new_users = Column(Boolean, nullable=False, server_default=sa.text("false"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())


class AdminObligationTemplate(Base):
    __tablename__ = "admin_obligation_templates"
    __table_args__ = {"schema": "pf"}

    id = Column(sa.BigInteger, primary_key=True)
    title = Column(String(200), nullable=False)
    total = Column(Numeric(20, 2), nullable=False, server_default="0")
    monthly = Column(Numeric(20, 2), nullable=False, server_default="0")
    rate = Column(Numeric(10, 4), nullable=False, server_default="0")
    due_day = Column(Integer, nullable=False, server_default="1")
    notes = Column(Text, nullable=False, server_default="")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=sa.func.now())
