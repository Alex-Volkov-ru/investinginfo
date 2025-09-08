# --- env ---
ifeq (,$(wildcard ./.env))
  $(error Файл .env не найден. Создайте его из .env.LOCAL)
endif
include .env
export $(shell sed 's/=.*//' .env)

# --- выбор compose-файла ---
# По умолчанию: локальный docker-compose.yml.
# Для прода: MODE=prod (или явно COMPOSE_FILE=...).
MODE ?= local
ifeq ($(origin COMPOSE_FILE), undefined)
  ifeq ($(MODE),prod)
    COMPOSE_FILE := docker-compose.production.yml
  else
    COMPOSE_FILE := docker-compose.yml
  endif
endif

DOCKER_COMPOSE := docker compose

# --- имена сервисов (совпадают в обоих compose) ---
DB_SVC      ?= db
FLYWAY_SVC  ?= flyway

# --- файлы-хелперы (опционально) ---
TRUNCATE_FILE  ?= ./env/pgsql/truncate.sql
TEST_DATA_FILE ?= ./env/pgsql/test_data.sql

# --- Flyway connection внутри docker-сети ---
# Postgres в сети compose всегда на 5432
FLYWAY_DB_HOST ?= $(DB_SVC)
FLYWAY_URL     := jdbc:postgresql://$(FLYWAY_DB_HOST):5432/$(POSTGRES_DB)

FLYWAY_BASE_OPTS := -url=$(FLYWAY_URL) -user=$(POSTGRES_USER) -password=$(POSTGRES_PASSWORD)
ifdef DB_SCHEMA
  FLYWAY_BASE_OPTS += -defaultSchema=$(DB_SCHEMA) -schemas=$(DB_SCHEMA)
endif

FLYWAY_RUN := $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) run --rm $(FLYWAY_SVC)

# --- phony ---
.PHONY: up down logs wait-db migrate drop reset create recreate truncate test_data psql help

# --- compose lifecycle ---
up:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d --build

down:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down

logs:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) logs -f $(DB_SVC) backend frontend

# дождаться готовности Postgres (когда сервис уже запущен)
wait-db:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) exec -T $(DB_SVC) sh -c 'until pg_isready -h localhost -U "$(POSTGRES_USER)" -d "$(POSTGRES_DB)"; do sleep 1; done; echo "DB is ready"'

# --- Flyway ---
migrate:
	$(FLYWAY_RUN) $(FLYWAY_BASE_OPTS) migrate

drop:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) run --rm -e FLYWAY_CLEAN_DISABLED=false $(FLYWAY_SVC) $(FLYWAY_BASE_OPTS) clean

reset: drop migrate

# накатить до первой миграции (baseline/target=1)
create:
	$(FLYWAY_RUN) $(FLYWAY_BASE_OPTS) migrate -target=1

recreate: drop create

# --- вспомогательные SQL ---
truncate:
	cat $(TRUNCATE_FILE) | $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) exec -T $(DB_SVC) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

test_data:
	cat $(TEST_DATA_FILE) | $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) exec -T $(DB_SVC) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

psql:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) exec $(DB_SVC) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

# --- help ---
help:
	@echo 'make up         - build & start containers'
	@echo 'make down       - stop containers'
	@echo 'make logs       - tail logs (db backend frontend)'
	@echo 'make wait-db    - wait until Postgres is ready'
	@echo 'make migrate    - apply Flyway migrations'
	@echo 'make drop       - flyway clean (uses -cleanDisabled=false)'
	@echo 'make reset      - clean + migrate'
	@echo 'make create     - migrate to target=1 (empty schema)'
	@echo 'make recreate   - drop + create (target=1)'
	@echo 'make truncate   - run env/pgsql/truncate.sql'
	@echo 'make test_data  - run env/pgsql/test_data.sql'
	@echo 'make psql       - open psql in db container'
