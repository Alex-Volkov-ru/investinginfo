"""
Централизованные валидаторы для регистрации и профиля пользователя.
"""

from __future__ import annotations

import re

# --- Email ---
EMAIL_MAX_LENGTH = 254
EMAIL_LOCAL_MAX_LENGTH = 64
EMAIL_DOMAIN_MAX_LENGTH = 63

_LOCAL_PART_RE = re.compile(r"^[a-zA-Z0-9._+-]+$")
_DOMAIN_LABEL_RE = re.compile(r"^[a-zA-Z0-9-]+$")

# --- Логин сервиса (tg_username) ---
SERVICE_LOGIN_MIN_LENGTH = 3
SERVICE_LOGIN_RE = re.compile(r"^[a-zA-Z0-9._-]+$")

# --- Пароль ---
PASSWORD_MIN_LENGTH = 8
_PASSWORD_PRINTABLE_ASCII_RE = re.compile(r"^[\x21-\x7E]+$")
_PASSWORD_LOWER_RE = re.compile(r"[a-z]")
_PASSWORD_UPPER_RE = re.compile(r"[A-Z]")


def validate_email(email: str) -> str:
    """
    Полная валидация email по правилам RFC-подобной проверки.
    """
    if email is None:
        raise ValueError("Email не может быть пустым")

    value = email.strip()
    if not value:
        raise ValueError("Email не может быть пустым")

    if len(value) > EMAIL_MAX_LENGTH:
        raise ValueError(f"Email не может быть длиннее {EMAIL_MAX_LENGTH} символов")

    if value.count("@") != 1:
        raise ValueError("Некорректный формат email")

    local, domain = value.rsplit("@", 1)

    if not local:
        raise ValueError("Некорректный формат email: пустое имя до @")
    if len(local) > EMAIL_LOCAL_MAX_LENGTH:
        raise ValueError(f"Имя email до @ не может быть длиннее {EMAIL_LOCAL_MAX_LENGTH} символов")
    if local.startswith("."):
        raise ValueError("Некорректный формат email: точка в начале имени")
    if local.endswith("."):
        raise ValueError("Некорректный формат email: точка перед @")
    if ".." in local:
        raise ValueError("Некорректный формат email: две точки подряд в имени")
    if not _LOCAL_PART_RE.match(local):
        raise ValueError("Некорректный формат email: недопустимые символы в имени")

    if not domain:
        raise ValueError("Некорректный формат email: пустой домен")
    if len(domain) > EMAIL_DOMAIN_MAX_LENGTH:
        raise ValueError(f"Домен после @ не может быть длиннее {EMAIL_DOMAIN_MAX_LENGTH} символов")
    if domain.startswith("."):
        raise ValueError("Некорректный формат email: точка в начале домена")
    if domain.endswith("."):
        raise ValueError("Некорректный формат email: точка в конце домена")
    if ".." in domain:
        raise ValueError("Некорректный формат email: две точки подряд в домене")

    labels = domain.split(".")
    if len(labels) < 2:
        raise ValueError("Некорректный формат email: домен должен содержать точку")

    for label in labels:
        if not label:
            raise ValueError("Некорректный формат email: пустая часть домена")
        if len(label) > 63:
            raise ValueError("Некорректный формат email: часть домена длиннее 63 символов")
        if label.startswith("-") or label.endswith("-"):
            raise ValueError("Некорректный формат email: дефис в начале или конце части домена")
        if not _DOMAIN_LABEL_RE.match(label):
            raise ValueError("Некорректный формат email: недопустимые символы в домене")

    return value


def validate_service_login(value: str | None, *, required: bool = False) -> str | None:
    """
    Логин сервиса: латиница, цифры, . _ -
    При создании пользователя — обязателен.
    """
    if value is None or not str(value).strip():
        if required:
            raise ValueError("Логин сервиса обязателен")
        return None

    login = str(value).strip()
    if len(login) < SERVICE_LOGIN_MIN_LENGTH:
        raise ValueError(f"Логин сервиса: минимум {SERVICE_LOGIN_MIN_LENGTH} символа")
    if not SERVICE_LOGIN_RE.match(login):
        raise ValueError("Логин сервиса: только латиница, цифры и символы . _ -")
    return login


def validate_password(value: str) -> str:
    """
    Пароль: ≥8 символов, латиница + цифры + спецсимволы, без кириллицы,
    минимум одна строчная и одна прописная латинская буква.
    """
    if not value:
        raise ValueError("Пароль не может быть пустым")
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Пароль: минимум {PASSWORD_MIN_LENGTH} символов")
    if not _PASSWORD_PRINTABLE_ASCII_RE.match(value):
        raise ValueError("Пароль: только латиница, цифры и спецсимволы (без кириллицы)")
    if not _PASSWORD_LOWER_RE.search(value):
        raise ValueError("Пароль: минимум одна строчная латинская буква")
    if not _PASSWORD_UPPER_RE.search(value):
        raise ValueError("Пароль: минимум одна прописная латинская буква")
    return value
