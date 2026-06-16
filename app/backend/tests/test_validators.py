import pytest

from app.backend.core.validators import validate_password, validate_email


def test_validate_email_ok():
    assert validate_email("user@example.com") == "user@example.com"


def test_validate_email_bad():
    with pytest.raises(ValueError):
        validate_email("not-an-email")


def test_validate_password_strong():
    assert validate_password("Secure1!pass") == "Secure1!pass"


def test_validate_password_weak():
    with pytest.raises(ValueError):
        validate_password("short")
