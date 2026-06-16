"""Production config validation."""

import pytest

from app.backend.core.config import Settings, _DEV_DATABASE_URL, _DEV_SECRET_KEY

_STRONG_SECRET = "production-secret-key-with-enough-entropy!!"


def test_development_allows_defaults():
    s = Settings()
    assert s.SECRET_KEY


def test_production_rejects_weak_secret(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(
            SECRET_KEY=_DEV_SECRET_KEY,
            DATABASE_URL="postgresql+psycopg2://user:pass@db:5432/prod",
            ALLOWED_ORIGINS=["https://example.com"],
            DEBUG=False,
        )


def test_production_rejects_wildcard_cors(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValueError, match="ALLOWED_ORIGINS"):
        Settings(
            SECRET_KEY=_STRONG_SECRET,
            DATABASE_URL="postgresql+psycopg2://user:pass@db:5432/prod",
            ALLOWED_ORIGINS=["*"],
            DEBUG=False,
        )


def test_production_rejects_dev_database(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValueError, match="DATABASE_URL"):
        Settings(
            SECRET_KEY=_STRONG_SECRET,
            DATABASE_URL=_DEV_DATABASE_URL,
            ALLOWED_ORIGINS=["https://example.com"],
            DEBUG=False,
        )


def test_production_accepts_valid_config(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    s = Settings(
        SECRET_KEY=_STRONG_SECRET,
        DATABASE_URL="postgresql+psycopg2://user:pass@db:5432/prod",
        ALLOWED_ORIGINS=["https://example.com"],
        DEBUG=False,
    )
    assert s.DEBUG is False
