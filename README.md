# WealthTracker — Portfolio & Budget Management System https://avolkovshop.ru/

> **Полнофункциональная система управления портфелем и бюджетом**: FastAPI backend + современный фронтенд (HTML/JS/CSS) + PostgreSQL + Redis + Nginx. Включает модули для инвестиций, бюджетирования и управления обязательствами. Полностью в Docker с поддержкой продакшена.

---

## Содержание
- [Функциональность](#функциональность)
- [Архитектура](#архитектура)
- [Быстрый старт (локально)](#быстрый-старт-локально)
- [Переменные окружения](#переменные-окружения)
- [API Endpoints](#api-endpoints)
- [URL-ы и здоровье](#url-ы-и-здоровье)
- [Как проверить Redis](#как-проверить-redis)
- [Деплой на сервер](#деплой-на-сервер)
- [Обновление релиза](#обновление-релиза)
- [Ручные команды](#ручные-команды)
- [Траблшутинг](#траблшутинг)
- [Структура репозитория](#структура-репозитория)

---

## Функциональность

### **Модуль инвестиций**
- **Управление портфелем** - добавление/редактирование активов
- **Интеграция с Tinkoff Invest API** - автоматическое получение котировок
- **Визуализация** - графики аллокации по классам и тикерам
- **Итоговые плашки** - общая стоимость, акции, ОФЗ, фонды
- **Поиск и фильтрация** - быстрый поиск по позициям

### **Модуль бюджетирования**
- **Учет доходов и расходов** - категории, счета, транзакции
- **Месячная аналитика** - сводки по периодам
- **Визуализация** - графики доходов/расходов
- **Управление счетами** - наличные, карты, сбережения
- **Категории** - гибкая система категоризации

### **Модуль обязательств**
- **Кредитные обязательства** - ипотека, кредиты, займы
- **Планирование платежей** - график, проценты, тело кредита
- **Отслеживание прогресса** - оплаченная/оставшаяся сумма
- **Итоговые плашки** - общая сумма, кредиты, оплачено, осталось
- **Модальные окна** - удобное добавление и редактирование

### **Система безопасности**
- **JWT аутентификация** - безопасный вход/регистрация
- **Rate limiting** - защита от злоупотреблений
- **Redis кэширование** - оптимизация производительности
- **CORS настройки** - безопасные запросы

---

## Архитектура

**Сервисы (Docker Compose):**
- **db** — `postgres:16-alpine` (персистентный том `pg_data`).
- **cli-flyway / flyway** — миграции схемы (`/env/pgsql/migrations`). Запускаются 1 раз при старте.
- **redis** — `redis:7-alpine`, используется для кэша и простого rate‑limit.
- **backend** — FastAPI (`app/backend`), Uvicorn. Работает по `:8000`.
- **frontend**  
  - локально — `nginx:alpine` + конфиг `env/frontend/local.conf` (статические файлы из `app/frontend`, прокси `/api -> backend`);
  - в проде — фронтенд кладётся в том `frontend_volume`, а внешний **nginx** отдаёт статику и проксит API.
- **nginx (prod)** — внешний веб‑сервер (80/443), SSL из `./certbot/conf`, статика из тома `frontend_volume`, прокси на `backend`.
- **certbot (prod)** — получение/обновление сертификатов Let’s Encrypt через webroot.

---

## Быстрый старт (локально)

1) **Подготовь `.env` в корне** (см. раздел ниже). Пример значений для локалки уже подходит:
```env
POSTGRES_USER=bigs
POSTGRES_PASSWORD=bigs_pass
POSTGRES_DB=bigsdb
DATABASE_URL=postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb
REDIS_URL=redis://bigs-redis:6379/0
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
BACKEND_PORT=8000
APP_PORT=8080
TZ=Europe/Moscow
DEBUG=True
LOG_LEVEL=DEBUG
```

2) **Запусти контейнеры:**
```bash
docker compose up -d --build
```

3) **Открой:**
- Фронтенд: http://localhost:8080  
- API (локально): http://127.0.0.1:8000/docs

> В локальном `frontend` nginx‑конфиг (`env/frontend/local.conf`) проксирует запросы с `/api/*` на `backend`.

4) **Остановить:**
```bash
docker compose down
```

---~

## Переменные окружения

Основные (файл `.env` в корне):
- **DB**
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  - `DATABASE_URL` — строка подключения для бекенда, например `postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb`
- **REDIS**
  - `REDIS_URL` — `redis://bigs-redis:6379/0`
- **SECURITY / CORS**
  - `SECRET_KEY`, `ALGORITHM` (по умолчанию `HS256`), `ACCESS_TOKEN_EXPIRE_MINUTES`
  - `ALLOWED_ORIGINS` — список доменов через запятую
- **APP**
  - `BACKEND_PORT` (обычно `8000`), `APP_PORT` (локальный фронт `8080`), `TZ`
  - `DEBUG`, `LOG_LEVEL`
- **(опционально)** Tinkoff API
  - `TINKOFF_API_TOKEN` / `TINKOFF_TOKEN`

SQL‑пул (опционально, уже учтено в коде):
- `SQL_POOL_SIZE`, `SQL_MAX_OVERFLOW`, `SQL_POOL_RECYCLE`, `SQL_POOL_TIMEOUT`

---

## API Endpoints

### **Аутентификация**
- `POST /auth/login` - вход в систему
- `POST /auth/register` - регистрация пользователя
- `POST /auth/refresh` - обновление токена

### **Бюджетирование**
- `GET /budget/accounts` - список счетов
- `POST /budget/accounts` - создание счета
- `GET /budget/categories` - список категорий
- `POST /budget/categories` - создание категории
- `GET /budget/transactions` - список транзакций
- `POST /budget/transactions` - создание транзакции
- `GET /budget/summary/month` - месячная сводка
- `GET /budget/summary/charts` - данные для графиков

### **Обязательства**
- `GET /budget/obligations` - список обязательств
- `POST /budget/obligations` - создание обязательства
- `GET /budget/obligation-blocks` - блоки обязательств (кредиты)
- `POST /budget/obligation-blocks` - создание блока обязательства
- `PUT /budget/obligation-blocks/{id}` - обновление блока
- `DELETE /budget/obligation-blocks/{id}` - удаление блока

### **Инвестиции** (через Tinkoff API)
- `GET /portfolio` - портфель пользователя
- `GET /market/instruments` - инструменты рынка
- `GET /market/candles` - свечи по инструментам

### **Система**
- `GET /health/ping` - проверка здоровья API
- `GET /users/me` - информация о текущем пользователе

---

## URL-ы и здоровье

- **Проверка API**: `GET /health/ping` → `{"status":"ok"}`
- **Фронтенд**: SPA на чистом HTML/JS/CSS (`app/frontend`)
  - `/` - инвестиции (index.html)
  - `/budget.html` - бюджетирование
  - `/obligations.html` - обязательства
  - `/login.html` - авторизация

---

## Как проверить Redis

**Внутри Redis‑контейнера:**
```bash
docker exec -it bigs-redis redis-cli ping      # -> PONG
docker exec -it bigs-redis redis-cli setex test:foo 10 bar
docker exec -it bigs-redis redis-cli get test:foo
```

**Из backend‑контейнера (через Python):**
```bash
docker exec -i bigs-backend python - <<'PY'
import os, asyncio
import redis.asyncio as redis
url = os.environ.get('REDIS_URL','redis://bigs-redis:6379/0')
async def main():
    r = redis.from_url(url, encoding="utf-8", decode_responses=True)
    await r.setex("test:from_backend", 20, "ok-from-backend")
    print("value:", await r.get("test:from_backend"))
    await r.aclose()
asyncio.run(main())
PY
```

---

## Деплой на сервер

1) **Скопируй проект** на сервер и создай `.env` (боевой):
```env
POSTGRES_USER=user
POSTGRES_PASSWORD=pass
POSTGRES_DB=bigsdb
DATABASE_URL=postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb

REDIS_URL=redis://bigs-redis:6379/0
SECRET_KEY=super_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Разрешённые фронты (добавь свой домен/IP):
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080

BACKEND_PORT=8000
APP_PORT=8080
TZ=Europe/Moscow
DEBUG=False
LOG_LEVEL=INFO
```

2) **Проверь `nginx.conf`** (прод): в корне репо. В нём:
- 80 → редирект на HTTPS
- 443 → статика из тома `frontend_volume`, прокси на `bigs-backend:8000`
- Сертификаты: `/etc/letsencrypt/live/avolkovshop.ru/...`

3) **Первичный запуск без SSL (или с пустыми сертификатами)**, чтобы получить webroot для certbot:
```bash
docker compose -f docker-compose.production.yml up -d
```

4) **Выпусти сертификат (webroot `/var/www/certbot`)**:
```bash
docker run --rm -it \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d avolkovshop.ru -d www.avolkovshop.ru --agree-tos -m you@example.com --non-interactive
```

5) **Перезапусти nginx**, чтобы подхватил сертификаты:
```bash
docker compose -f docker-compose.production.yml restart nginx
```

С этого момента сайт работает по HTTPS. `certbot` можно запускать раз в ~60 дней для обновления:
```bash
docker run --rm -it \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot renew --webroot -w /var/www/certbot
```

---

## Обновление релиза

### Вариант A: образы на Docker Hub
1) Локально собрать и запушить:
```bash
# backend
docker build -t YOUR_DH/bigs_backend:latest -f env/backend/Dockerfile .
docker push YOUR_DH/bigs_backend:latest

# frontend (если упаковываешь в образ)
docker build -t YOUR_DH/bigs_frontend:latest -f env/frontend/Dockerfile .
docker push YOUR_DH/bigs_frontend:latest
```

2) На сервере:
```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

### Вариант B: сборка на сервере
```bash
docker compose -f docker-compose.production.yml up -d --build
```

---

## Ручные команды

- **Логи:**
```bash
docker logs -f bigs-backend
docker logs -f bigs-nginx
docker logs -f bigs-db
```

- **Проверка активной конфигурации nginx (prod):**
```bash
docker exec -it bigs-nginx nginx -T
```

- **Ручной прогон миграций (повторно):**
```bash
docker compose run --rm cli-flyway migrate
```

- **Резервные копии БД:**
```bash
# dump
docker exec -t bigs-db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > backup.sql
# restore (внимательно! перезапишет данные)
cat backup.sql | docker exec -i bigs-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

---

## Структура репозитория

```
.
├─ app/
│  ├─ backend/                # FastAPI Backend
│  │  ├─ core/                # Основные компоненты
│  │  │  ├─ auth.py           # JWT аутентификация
│  │  │  ├─ cache.py          # Redis кэширование
│  │  │  ├─ config.py         # Настройки приложения
│  │  │  └─ security.py       # Безопасность
│  │  ├─ api/                 # API эндпоинты
│  │  │  ├─ budget_accounts.py      # Управление счетами
│  │  │  ├─ budget_categories.py    # Категории доходов/расходов
│  │  │  ├─ budget_transactions.py  # Транзакции
│  │  │  ├─ budget_summary.py       # Сводки и аналитика
│  │  │  ├─ budget_obligations.py   # Простые обязательства
│  │  │  └─ budget_obligation_blocks.py # Кредитные блоки
│  │  ├─ models/              # SQLAlchemy модели
│  │  │  ├─ user.py           # Пользователи
│  │  │  ├─ budget.py         # Бюджетные модели
│  │  │  ├─ instrument.py     # Инвестиционные инструменты
│  │  │  └─ portfolio.py      # Портфель
│  │  ├─ routes/              # Маршруты
│  │  │  ├─ auth.py           # Авторизация
│  │  │  ├─ users.py          # Пользователи
│  │  │  ├─ portfolio.py      # Портфель
│  │  │  └─ market.py         # Рынок
│  │  ├─ db/                  # База данных
│  │  │  ├─ base.py           # Базовые модели
│  │  │  └─ session.py        # Сессии БД
│  │  ├─ main.py              # Точка входа
│  │  └─ app.py               # FastAPI приложение
│  └─ frontend/               # Frontend (HTML/CSS/JS)
│     ├─ assets/
│     │  ├─ css/              # Стили
│     │  │  ├─ style.css      # Основные стили
│     │  │  ├─ critical.css   # Критические стили
│     │  │  ├─ budget.css     # Стили бюджетирования
│     │  │  ├─ obligations.css # Стили обязательств
│     │  │  └─ login.css      # Стили авторизации
│     │  └─ js/               # JavaScript
│     │     ├─ script.js      # Основная логика
│     │     ├─ budget.js      # Логика бюджетирования
│     │     ├─ obligations.js # Логика обязательств
│     │     ├─ login.js       # Логика авторизации
│     │     └─ network-optimizer.js # Оптимизация сети
│     ├─ index.html           # Инвестиции
│     ├─ budget.html          # Бюджетирование
│     ├─ obligations.html     # Обязательства
│     └─ login.html           # Авторизация
├─ env/
│  ├─ backend/Dockerfile      # Backend контейнер
│  ├─ frontend/Dockerfile     # Frontend контейнер
│  ├─ frontend/local.conf     # Локальный nginx
│  └─ pgsql/
│     ├─ migrations/          # Flyway миграции
│     ├─ initdb.sql           # Инициализация БД
│     └─ override.conf        # Настройки PostgreSQL
├─ certbot/                   # SSL сертификаты
│  ├─ conf/                   # Let's Encrypt
│  └─ www/                    # Webroot
├─ docker-compose.yml         # Локальная разработка
├─ docker-compose.production.yml # Продакшен
├─ nginx.conf                 # Продакшен nginx
├─ .env                       # Переменные окружения
└─ README.md                  # Документация
```

---

## Технологии и особенности

### **Backend**
- **FastAPI** - современный веб-фреймворк для Python
- **SQLAlchemy** - ORM для работы с базой данных
- **PostgreSQL** - надежная реляционная БД
- **Redis** - кэширование и rate limiting
- **JWT** - безопасная аутентификация
- **Flyway** - миграции базы данных

### **Frontend**
- **Vanilla JavaScript** - без фреймворков, быстрая загрузка
- **CSS Grid/Flexbox** - современная верстка
- **Chart.js** - красивые графики и диаграммы
- **Axios** - HTTP клиент для API
- **Critical CSS** - оптимизация загрузки
- **PWA готовность** - мета-теги для мобильных

### **Производительность**
- **Docker контейнеризация** - быстрый деплой
- **Nginx** - быстрая раздача статики
- **Redis кэширование** - ускорение запросов
- **Оптимизированные запросы** - индексы БД
- **Lazy loading** - асинхронная загрузка ресурсов

### **Безопасность**
- **HTTPS** - шифрование трафика
- **JWT токены** - безопасная аутентификация
- **Rate limiting** - защита от атак
- **CORS** - контролируемые запросы
- **Валидация данных** - Pydantic схемы
