"""Token and amount encryption roundtrip."""

from decimal import Decimal

from app.backend.core.security import decrypt_amount, decrypt_token, encrypt_amount, encrypt_token


def test_encrypt_decrypt_token_roundtrip():
    plain = "tinkoff-api-token-12345"
    enc = encrypt_token(plain)
    assert enc != plain
    assert decrypt_token(enc) == plain


def test_encrypt_decrypt_amount_roundtrip():
    amount = Decimal("12345.67")
    enc = encrypt_amount(amount)
    assert decrypt_amount(enc) == amount


def test_empty_values():
    assert encrypt_token("") == ""
    assert decrypt_token("") == ""
    assert decrypt_amount("") == Decimal(0)
