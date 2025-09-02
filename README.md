## Автор проекта:
**Волков Александр** — [https://t.me/ximikat01](https://t.me/ximikat01)


# BIGS — инвестиционный портфель (Frontend + FastAPI)

Небольшой сервис для ведения личного инвестиционного портфеля: регистрация/логин (JWT), создание портфелей, добавление/редактирование позиций, графики, котировки и свечи через Tinkoff Invest API. Фронтенд — на чистом HTML/JS/CSS, бэкенд — FastAPI + SQLAlchemy + PostgreSQL. 

## Возможности

- Регистрация и вход (JWT), хранение токена в `localStorage`  
- Портфель пользователя: создание, список, позиции
- Добавление активов: акции, облигации, фонды, а также пополнения «накопительного счёта»
- Рефреш котировок и отрисовка графиков (Chart.js)
- История стоимости портфеля (локально в браузере)
- Свечи по FIGI за периоды 1D/1W/1M/1Y
- Резолв тикера → FIGI / класс инструмента
- Готовый Docker Compose (Postgres + бэкенд + Nginx для фронта)

---

## Стек

- **Backend:** FastAPI, SQLAlchemy, Pydantic, jose (JWT), Tinkoff Invest SDK  
- **DB:** PostgreSQL 16  
- **Frontend:** HTML + CSS + JS (axios, Chart.js, Flatpickr)  
- **Runtime:** Docker Compose (3 контейнера)  

---

## Структура проекта (основное)

```
app/
  backend/
    ... (FastAPI-приложение)
  frontend/
    index.html     # личный кабинет (портфель)
    login.html     # авторизация/регистрация
env/
  backend/Dockerfile
  pgsql/          # init/migrations
  localtime
docker-compose.yml
.env              
```

---

## Быстрый старт (Docker)

### 1) Создайте `.env` в корне
Заполните переменные окружения. Ниже пример, который можно адаптировать под себя.

```ini
# --- Project ---
COMPOSE_PROJECT_NAME=bigs

TZ=Europe/Moscow
APP_PORT=8080              # порт фронтенда (Nginx)
BACKEND_PORT=8000          # внешний порт бэкенда

# --- DB ---
POSTGRES_USER=bigs
POSTGRES_PASSWORD=bigs_pass
POSTGRES_DB=bigsdb
POSTGRES_PORT=5432

# JDBC/SQLAlchemy DSN (Важно: схема pf создается init-скриптом)
DATABASE_URL=postgresql+psycopg2://bigs:bigs_pass@db:5432/bigsdb

# --- Auth ---
SECRET_KEY=dev_secret_key_please_change
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# --- CORS ---
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080

# --- Market --- (опционально, для котировок/свечей)
TINKOFF_TOKEN=your_tinkoff_invest_api_token_here
```

> Если TINKOFF_TOKEN не заполнен, котировки и свечи недоступны. Добавление/редактирование позиций и «накопительного счёта» работает.

### 2) Запустите Docker Compose
```bash
docker compose up -d --build
```

Будут подняты:
- **bigs-db** — PostgreSQL на `localhost:5432`
- **bigs-backend** — FastAPI на `http://localhost:8000`
- **bigs-frontend** — Nginx, раздаёт фронтенд на `http://localhost:8080`

### 3) Откройте браузер
- Фронтенд: **http://localhost:8080/login.html**  
- После авторизации — редирект на **index.html** (личный кабинет).

---

## Как пользоваться (браузер)

1. Перейдите на `/login.html`, зарегистрируйтесь (email/пароль), затем войдите.  
2. После входа токен/пользователь будут сохранены в `localStorage`, вы окажетесь на `/index.html`.
3. На странице кабинета:
   - Кнопка «Добавить актив»: выберите тип, введите тикер (для бумаг), количество, цену и дату.
   - Для бумаг тикер резолвится в FIGI автоматически.  
   - Кнопка «Обновить» подтянет текущие котировки для всех бумаг портфеля.
   - Нажмите «📈 График» у позиции, чтобы раскрыть сводный график с периодами (1D/1W/1M/1Y).
   - «✨ Мой портфель» — редактируемое название.
   - «🚪 Выйти» — очистит авторизацию и вернёт на `/login.html`.

---

## API (коротко)

Все эндпоинты (кроме регистрации и логина) — под `Bearer <token>`.

### Аутентификация
- `POST /users` — регистрация пользователя  
  **Body:** `{ "email": "...", "password": "...", "phone": "..." }`  
- `POST /auth/login` — вход  
  **Body:** `{ "email": "...", "password": "..." }` → `{ "access_token": "...", "user_id": 1 }`

### Портфель
- `GET /portfolio` — список портфелей текущего пользователя  
- `POST /portfolio` — создать портфель `{ "title":"Основной","type":"broker","currency":"RUB" }`
- `GET /portfolio/{id}/positions` — позиции (коротко)  
- `GET /portfolio/{id}/positions/full` — позиции + привязанный инструмент  
- `POST /portfolio/positions` — создать/обновить позицию  
  ```json
  {
    "portfolio_id": 1,
    "ticker": "SBER",
    "class_hint": "share",       // share | bond | etf
    "figi": "BBG004730N88",
    "quantity": 10,
    "avg_price": 250.00,
    "name": "Сбербанк",
    "currency": "RUB",
    "nominal": null
  }
  ```
- `DELETE /portfolio/positions/{position_id}` — удалить позицию

### Рынок (Tinkoff)
- `GET /resolve?ticker=SBER` — варианты FIGI для тикера  
- `GET /quote/{figi}` — последняя цена (нормализовано, с учётом класса)
- `GET /candles/{figi}?interval=1d&from_=ISO&to=ISO` — свечи
- `POST /quotes_by_tickers` — пакет котировок по тикерам  
  ```json
  { "tickers": ["SBER","TCSG"], "class_hint": "share" }
  ```

---

## Примеры `curl`

```bash
# Регистрация
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'

# Вход
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
# → сохраните access_token из ответа
TOKEN="PASTE_TOKEN_HERE"

# Создать портфель
curl -X POST http://localhost:8000/portfolio \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Основной","type":"broker","currency":"RUB"}'

# Получить портфели
curl -s http://localhost:8000/portfolio \
  -H "Authorization: Bearer ${TOKEN}" | jq

# Резолв FIGI для тикера
curl -s "http://localhost:8000/resolve?ticker=SBER" | jq

# Котировка по FIGI
curl -s http://localhost:8000/quote/BBG004730N88 | jq

# Добавить/обновить позицию
curl -X POST http://localhost:8000/portfolio/positions \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "portfolio_id": 1,
    "ticker": "SBER",
    "class_hint": "share",
    "figi": "BBG004730N88",
    "quantity": 3,
    "avg_price": 317
  }'

# Позиции (полные)
curl -s http://localhost:8000/portfolio/1/positions/full \
  -H "Authorization: Bearer ${TOKEN}" | jq

# Свечи
curl -s "http://localhost:8000/candles/BBG004730N88?interval=1d" | jq
```

---

## Полезные адреса
- Фронтенд: **http://localhost:8080/**
  - Страница входа: `/login.html`
  - Кабинет: `/index.html`
- Бэкенд (Swagger): **http://localhost:8000/docs**

---

## Dev без Docker (опционально)

### Бэкенд
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg2://bigs:bigs_pass@localhost:5432/bigsdb"
export ALLOWED_ORIGINS="http://localhost:8080"
export SECRET_KEY="dev_secret"
export TINKOFF_TOKEN="..."   # при наличии

uvicorn app.backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Фронтенд
Любой статический сервер, например:
```bash
python -m http.server 8080 -d app/frontend
```
Откройте `http://localhost:8080/login.html`.

---

## Примечания

- Параметр `ALLOWED_ORIGINS` должен включать адрес фронтенда (по умолчанию `http://localhost:8080`).  
- Схема БД `pf` создаётся init-скриптом `env/pgsql/initdb.sql`.  
- Для котировок/свечей необходим рабочий `TINKOFF_TOKEN`.  

Удачной торговли! 🚀
