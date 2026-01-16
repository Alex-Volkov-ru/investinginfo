from __future__ import annotations

from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)

def verify_password(raw: str, hashed: str) -> bool:
    return pwd_context.verify(raw, hashed)


import base64, hashlib
from decimal import Decimal
from cryptography.fernet import Fernet, InvalidToken
from app.backend.core.config import get_settings

def _get_fernet() -> Fernet:
    """
    Производим ключ для Fernet из SECRET_KEY приложения (SHA-256 → urlsafe b64).
    ВАЖНО: смена SECRET_KEY сделает расшифровку старых токенов невозможной.
    """
    settings = get_settings()
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)

def encrypt_token(plain: str) -> str:
    if not plain:
        return ""
    f = _get_fernet()
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")

def decrypt_token(enc: str) -> str:
    if not enc:
        return ""
    f = _get_fernet()
    try:
        return f.decrypt(enc.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


# ===== Шифрование сумм транзакций =====

def encrypt_amount(amount: Decimal | float | str) -> str:
    """
    Шифрует сумму транзакции для безопасного хранения в БД.
    """
    if amount is None:
        return ""
    amount_str = str(amount)
    f = _get_fernet()
    return f.encrypt(amount_str.encode("utf-8")).decode("utf-8")


def decrypt_amount(enc: str) -> Decimal:
    """
    Расшифровывает сумму транзакции из БД.
    """
    if not enc:
        return Decimal("0")
    f = _get_fernet()
    try:
        decrypted = f.decrypt(enc.encode("utf-8")).decode("utf-8")
        return Decimal(decrypted)
    except (InvalidToken, ValueError):
        return Decimal("0")