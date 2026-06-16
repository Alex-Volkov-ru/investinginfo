# WealthTracker (investinfo)

Полноценная система личных финансов:
- инвестиции (портфель, котировки, аналитика),
- бюджет (счета, категории, транзакции),
- обязательства (графики платежей, напоминания),
- админ-панель,
- web + mobile UI.

Стек: `FastAPI` + `PostgreSQL` + `Redis` + `Flyway` + `React/TypeScript (Vite)` + `Docker Compose`.

---

## Что уже реализовано

- JWT авторизация и регистрация.
- Регистрация с полями: `email`, `full_name`, `password`, `tg_username`, `phone`, `tinkoff_token`.
- Профиль в шапке показывает **имя пользователя** (`full_name`), а не сервисный логин.
- Миграции БД через Flyway.
- Админ-функции: аудит, шаблоны, управление пользователями.
- Платежные напоминания, monthly review, whiteboard.

---

## Актуальная структура проекта

```text
app/
  backend/                # FastAPI
  frontend-react/         # React + TS + Vite
env/
  backend/Dockerfile
  frontend/Dockerfile
  frontend/Dockerfile.dev
  pgsql/migrations/       # Flyway SQL migrations
docker-compose.yml        # локальная среда
docker-compose.production.yml
```

---

## Быстрый старт (локально)

1. Подготовить `.env` в корне.

Минимально:

```env
POSTGRES_USER=bigs
POSTGRES_PASSWORD=bigs_pass
POSTGRES_DB=bigsdb
DATABASE_URL=postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb
REDIS_URL=redis://bigs-redis:6379/0

SECRET_KEY=change_me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
BACKEND_PORT=8000
APP_PORT=8080
DEBUG=false
TZ=Europe/Moscow
```

2. Запуск:

```bash
docker compose up -d --build
```

3. Проверка:
- frontend: `http://localhost:8080`
- backend health: `http://localhost:8000/health/ping`
- backend docs: `http://localhost:8000/docs`

4. Остановка:

```bash
docker compose down
```

---

## Миграции БД

Миграции лежат в `env/pgsql/migrations`.

Новая схема пользователя включает `pf.users.full_name`.

Миграция:
- `V12__Add_User_Full_Name.sql`:
  - добавляет `full_name`,
  - бэкофиллит для существующих пользователей из `tg_username` или части email,
  - ставит `NOT NULL`.

Проверка:

```bash
docker exec bigs-db psql -U bigs -d bigsdb -c "SELECT version, success FROM pf.flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;"
docker exec bigs-db psql -U bigs -d bigsdb -c "\d+ pf.users"
```

---

## Auth/API (актуально)

### Auth
- `POST /auth/login`
- `POST /auth/register`

`/auth/register` ожидает:

```json
{
  "email": "user@example.com",
  "full_name": "Александр",
  "password": "StrongPass1!",
  "tg_username": "alex_01",
  "phone": "+79991234567",
  "tinkoff_token": "t...."
}
```

`LoginOut` возвращает:
- `access_token`
- `user_id`
- `email`
- `full_name`
- `tg_username`
- `has_tinkoff`
- `is_staff`

### Users
- `GET /users/me`
- `PUT /users/me/name` (обновляет `full_name`)
- `PUT /users/me/email`
- `PUT /users/me/token`

---

## Разработка frontend

Локальная dev-сборка:

```bash
docker compose up -d frontend-dev
```

Порт: `5173`.

Production-frontend в compose:
- сервис `frontend` (nginx + статическая сборка),
- порт `8080`.

---

## Проверка состояния сервисов

```bash
docker compose ps
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

---

## Деплой/обновление

Базовый сценарий:

```bash
git pull
docker compose up -d --build backend frontend
docker compose ps
```

После обновления auth/регистрации обязательно проверить:
- регистрацию нового пользователя с `full_name`,
- вход существующего пользователя (имя должно быть заполнено автоматически, если раньше его не было),
- отображение имени в профиле шапки.

---

## Важные заметки

- `tg_username` сохраняется для совместимости и сервисных сценариев.
- В UI для человека используется `full_name`.
- Для существующих пользователей миграция безопасна: данные не теряются.
