# Сборка фронта (React/Vue)
FROM node:20-alpine as build

WORKDIR /app
COPY ./app/frontend/package*.json ./
RUN npm install --frozen-lockfile

COPY ./app/frontend .
RUN npm run build
