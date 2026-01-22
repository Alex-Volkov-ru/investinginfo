"""
Константы приложения для избежания хардкода и упрощения рефакторинга.
"""

from decimal import Decimal

# ===== Бизнес-константы =====

# Валюты
DEFAULT_CURRENCY = "RUB"
SUPPORTED_CURRENCIES = ["RUB", "USD", "EUR"]

# Кредиты
DEFAULT_DUE_DAY = 15
DEFAULT_OBLIGATION_STATUS = "Активный"
OBLIGATION_STATUSES = ["Активный", "Просрочен", "Закрыт"]
DEFAULT_PAYMENTS_COUNT = 20
DEFAULT_OBLIGATION_TITLE = "Обязательство"

# Дни недели
SATURDAY = 5
SUNDAY = 6

# Вычисления дат
MONTH_END_CALC_DAY = 28
MONTH_END_CALC_OFFSET = 4
DAYS_IN_YEAR = 365
ROUNDING_PRECISION = Decimal("0.01")
PERCENT_DIVISOR = 100

# Типы транзакций
TRANSACTION_TYPE_INCOME = "income"
TRANSACTION_TYPE_EXPENSE = "expense"
TRANSACTION_TYPE_TRANSFER = "transfer"
TRANSACTION_TYPES = [TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_EXPENSE, TRANSACTION_TYPE_TRANSFER]

# Типы категорий
CATEGORY_KIND_INCOME = "income"
CATEGORY_KIND_EXPENSE = "expense"
CATEGORY_KINDS = [CATEGORY_KIND_INCOME, CATEGORY_KIND_EXPENSE]

# Портфели
DEFAULT_PORTFOLIO_TYPE = "broker"
DEFAULT_INSTRUMENT_CLASS = "other"

# ===== Валидация =====

# Пароли
MIN_PASSWORD_LENGTH = 6
PASSWORD_PATTERN_LETTERS = r"[A-Za-z]"
PASSWORD_PATTERN_DIGITS = r"\d"

# Имена
MIN_USERNAME_LENGTH = 2

# Телефоны
PHONE_PATTERN = r"\+?\d{10,15}"
PHONE_MIN_DIGITS = 10
PHONE_MAX_DIGITS = 15

# Категории
CATEGORY_NAME_MIN_LENGTH = 1
CATEGORY_NAME_MAX_LENGTH = 100
CATEGORY_KIND_MIN_LENGTH = 6
CATEGORY_KIND_MAX_LENGTH = 7

# ===== Rate Limiting =====

# Логин
LOGIN_RATE_LIMIT = 5
LOGIN_RATE_WINDOW_SEC = 60

# Регистрация
REGISTER_RATE_LIMIT = 3
REGISTER_RATE_WINDOW_SEC = 3600

# Котировки
QUOTE_RATE_LIMIT = 30
QUOTE_RATE_WINDOW_SEC = 60
QUOTE_CACHE_TTL_SEC = 60

# Свечи
CANDLES_RATE_LIMIT = 60
CANDLES_RATE_WINDOW_SEC = 60
CANDLES_CACHE_TTL_SEC = 120
CANDLES_DEFAULT_DAYS = 30

# Инструменты
INSTRUMENTS_CACHE_TTL_SEC = 12 * 60 * 60  # 12 часов
BATCH_QUOTES_CACHE_TTL_SEC = 60

# ===== Округление и вычисления =====

BOND_DEFAULT_NOMINAL = 1000.0
NANO_TO_FLOAT_DIVISOR = 1e9
PERCENT_TO_DECIMAL = 100.0

# ===== Сообщения об ошибках =====

# Общие
ERROR_NOT_FOUND = "Не найдено"
ERROR_ACCOUNT_NOT_FOUND = "Счет не найден"
ERROR_CATEGORY_NOT_FOUND = "Категория не найдена"
ERROR_CATEGORY_EXISTS = "Категория уже существует"
ERROR_OBLIGATION_NOT_FOUND = "Обязательство не найдено"

# Транзакции
ERROR_TRANSACTION_NOT_FOUND = "Транзакция не найдена"
ERROR_INVALID_TRANSFER_PARAMS = "Неверные параметры перевода"
ERROR_ACCOUNTS_UNAVAILABLE = "Счета недоступны"
ERROR_ACCOUNT_INACTIVE = "Один из счетов неактивен"
ERROR_CATEGORY_REQUIRED_TEMPLATE = "Для транзакций типа '{type_name}' необходимо выбрать категорию"
ERROR_UNKNOWN_TRANSACTION_TYPE = "Неизвестный тип операции"

# Аутентификация
ERROR_INVALID_TOKEN = "Недействительный токен"
ERROR_USER_NOT_FOUND = "Пользователь не найден"
ERROR_INVALID_CREDENTIALS = "Неверный email или пароль"
ERROR_USER_EXISTS = "Пользователь с таким email уже существует"

# Валидация
ERROR_PASSWORD_WEAK_TEMPLATE = "Пароль должен содержать минимум {min_len} символов, буквы и цифры"
ERROR_USERNAME_SHORT_TEMPLATE = "Имя слишком короткое (минимум {min_len} символов)"
ERROR_PHONE_FORMAT_TEMPLATE = "Телефон в формате +7999123... или {min}–{max} цифр"

# Готовые сообщения (для обратной совместимости)
ERROR_PASSWORD_WEAK = ERROR_PASSWORD_WEAK_TEMPLATE.format(min_len=MIN_PASSWORD_LENGTH)
ERROR_USERNAME_SHORT = ERROR_USERNAME_SHORT_TEMPLATE.format(min_len=MIN_USERNAME_LENGTH)
ERROR_PHONE_FORMAT = ERROR_PHONE_FORMAT_TEMPLATE.format(min=PHONE_MIN_DIGITS, max=PHONE_MAX_DIGITS)

# Портфель
ERROR_PORTFOLIO_ACCESS_DENIED = "Нет доступа к этому портфелю"
ERROR_POSITION_NOT_FOUND = "Позиция не найдена"
ERROR_FIGI_REQUIRED = "Требуется figi (разрешай тикер через /resolve)"

# Рынок
ERROR_EMPTY_TICKER = "Пустой тикер"
ERROR_CACHE_EMPTY = "Кэш инструментов пуст, попробуйте позже"
ERROR_FIGI_NOT_FOUND_TEMPLATE = "FIGI по тикеру {ticker} не найден"
ERROR_NO_DATA_TEMPLATE = "Нет данных по FIGI={figi}"
ERROR_NO_TINKOFF_TOKEN = "У пользователя не задан Tinkoff токен"

# ===== HTTP статусы =====

HTTP_400_BAD_REQUEST = 400
HTTP_401_UNAUTHORIZED = 401
HTTP_403_FORBIDDEN = 403
HTTP_404_NOT_FOUND = 404
HTTP_409_CONFLICT = 409
HTTP_429_TOO_MANY_REQUESTS = 429
HTTP_503_SERVICE_UNAVAILABLE = 503

# ===== CORS =====

ALLOWED_HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
ALLOWED_HTTP_HEADERS = ["Authorization", "Content-Type"]
CORS_PREFLIGHT_MAX_AGE = 3600  # 1 час

# ===== Приложение =====

APP_TITLE = "Portfolio API"
APP_VERSION = "0.1.0"
DEFAULT_SERVER_PORT = 8000
DEFAULT_SERVER_HOST = "0.0.0.0"

