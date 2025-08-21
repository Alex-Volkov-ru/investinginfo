from __future__ import annotations

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.backend.db.base import Base

if TYPE_CHECKING:
    # чтобы избежать циклических импортов во время исполнения
    from app.backend.models.portfolio import Portfolio


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tg_username: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tg_chat_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Зашифрованный пользовательский токен Тинькофф
    tinkoff_token_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    portfolios: Mapped[List["Portfolio"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Прочие связи
    api_tokens: Mapped[list["ApiToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @property
    def has_tinkoff_token(self) -> bool:
        return bool(self.tinkoff_token_enc)


class ApiToken(Base):
    __tablename__ = "api_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="api_tokens")
