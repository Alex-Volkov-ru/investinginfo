# BIGS — Portfolio & Budget (FastAPI + Postgres + Redis + Nginx)

> Продакшен‑ориентированный шаблон: **FastAPI backend** + **чистый фронт (HTML/JS/CSS)** + **Postgres + Flyway** + **Redis (кэш + rate‑limit)** + **Nginx**. Полностью в Docker. Есть отдельные `docker-compose.yml` (локально) и `docker-compose.production.yml` (сервер).

---

## Содержание
- [Архитектура](#архитектура)
- [Быстрый старт (локально)](#быстрый-старт-локально)
- [Переменные окружения](#переменные-окружения)
- [URL-ы и здоровье](#url-ы-и-здоровье)
- [Как проверить Redis](#как-проверить-redis)
- [Деплой на сервер](#деплой-на-сервер)
- [Обновление релиза](#обновление-релиза)
- [Ручные команды](#ручные-команды)
- [Траблшутинг](#траблшутинг)
- [Структура репозитория](#структура-репозитория)

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

---

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

## URL-ы и здоровье

- **Проверка API**: `GET /health/ping` → `{"status":"ok"}`
- **Бюджет** (основное):
  - `/budget/accounts`, `/budget/categories`, `/budget/transactions`, `/budget/summary/*`, `/budget/obligations`
- **Фронтенд**: SPA на чистом HTML/JS/CSS (`app/frontend`)

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

**Предпосылки:** есть домен `avolkovshop.ru`, DNS на сервер, открыты порты 80/443.

1) **Скопируй проект** на сервер и создай `.env` (боевой):
```env
POSTGRES_USER=bigs
POSTGRES_PASSWORD=bigs_pass
POSTGRES_DB=bigsdb
DATABASE_URL=postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb

REDIS_URL=redis://bigs-redis:6379/0
SECRET_KEY=super_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Разрешённые фронты (добавь свой домен/IP):
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,https://avolkovshop.ru

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

## Траблшутинг

- **Порт 80/443 занят** — останови другой nginx или изменяй publish‑порты.
- **nginx не видит сертификаты** — проверь, что файлы появились в `./certbot/conf/live/avolkovshop.ru/` и том смонтирован в контейнер.
- **Redis‑ошибка подключения** — проверь `REDIS_URL` и сеть compose: контейнер `backend` должен резолвить `bigs-redis`.
- **База «пустая»** — посмотри логи `cli-flyway`. Миграции должны пройти до старта `backend`.
- **CORS** — добавь домен фронта в `ALLOWED_ORIGINS`.
- **Статика не обновляется** (prod) — проверь, что `frontend` положил файлы в том `frontend_volume`, и `nginx` использует именно его.

---

## Структура репозитория

```
.
├─ app/
│  ├─ backend/                # FastAPI, бизнес-логика, роуты
│  │  ├─ core/
│  │  │  └─ config.py         # Settings (DB, Redis, CORS, логгирование)
│  │  ├─ api/
│  │  │  └─ budget_*          # эндпоинты бюджета
│  │  ├─ ...                  # модели, безопасность и т.д.
│  │  └─ main.py              # uvicorn app.backend.main:app
│  └─ frontend/               # HTML/CSS/JS (SPA), budget.html, assets/*
├─ env/
│  ├─ backend/Dockerfile
│  ├─ frontend/Dockerfile     # (если собираешь фронт в образ)
│  ├─ frontend/local.conf     # локальный nginx (прокси /api -> backend)
│  ├─ nginx.conf              # (если держишь альтернативную prod-конфигурацию)
│  └─ pgsql/
│     ├─ migrations/          # Flyway SQL
│     ├─ override.conf        # (опционально) тюнинг Postgres
│     └─ initdb.sql           # первичная инициализация (если нужно)
├─ certbot/
│  ├─ conf/                   # /etc/letsencrypt (монтируется)
│  └─ www/                    # webroot для HTTP‑валидции
├─ docker-compose.yml                # локальный запуск
├─ docker-compose.production.yml     # прод
├─ nginx.conf                         # prod конфиг (монтируется в nginx)
├─ .env                               # окружение (лок/прод — разные значения)
└─ README.md
```

---

**Готово.** Если что-то не взлетает — смотри логи контейнеров и активную конфигурацию `nginx -T`. Вопросы — в Issues. Удачи!
