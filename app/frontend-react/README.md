# WealthTracker Frontend

React + TypeScript + Vite фронтенд для системы управления портфелем и бюджетом.

## Технологии

- **React 18.2.0** — UI библиотека
- **TypeScript 5.2.2** — типизация
- **Vite 5.0.8** — сборщик и dev-сервер
- **React Router DOM 6.20.0** — маршрутизация
- **Axios 1.6.2** — HTTP клиент
- **Tailwind CSS 3.3.6** — стилизация
- **Lucide React 0.294.0** — иконки
- **React Hot Toast 2.4.1** — уведомления
- **date-fns 2.30.0** — работа с датами

## Разработка

### Локальная разработка (без Docker)

1. Установите зависимости:
```bash
npm install
```

2. Запустите dev-сервер:
```bash
npm run dev
```

Приложение будет доступно на `http://localhost:5173`

### Разработка с Docker

Используйте сервис `frontend-dev` в docker-compose.yml:

```bash
docker compose up frontend-dev
```

## Сборка для продакшена

```bash
npm run build
```

Собранные файлы будут в папке `dist/`.

## Структура проекта

```
src/
├── components/      # Переиспользуемые компоненты
├── contexts/        # React контексты (Auth)
├── lib/             # Утилиты (API клиент, auth)
├── pages/           # Страницы приложения
├── services/        # Сервисы для работы с API
├── types/           # TypeScript типы
├── App.tsx          # Главный компонент
├── main.tsx         # Точка входа
└── index.css        # Глобальные стили
```

## Переменные окружения

- `VITE_API_URL` — URL API (по умолчанию `/api`)

## API интеграция

Все API запросы идут через `/api`, который проксируется на backend через nginx или Vite dev server.

