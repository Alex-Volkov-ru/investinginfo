# --- env ---
ifeq (,$(wildcard ./.env))
    $(error Файл .env не найден. Создайте его из .env.LOCAL)
endif
include .env
export $(shell sed 's/=.*//' .env)

# --- bins ---
DOCKER_COMPOSE := docker compose

# --- service names in docker-compose.yml ---
DB_SVC      ?= db
FLYWAY_SVC  ?= cli-flyway

# --- SQL helpers (по желанию) ---
TRUNCATE_FILE  ?= ./env/pgsql/truncate.sql
TEST_DATA_FILE ?= ./env/pgsql/test_data.sql

# --- Flyway connection (по умолчанию идём к сервису DB в сети compose) ---
FLYWAY_DB_HOST ?= $(DB_SVC)
FLYWAY_URL     := jdbc:postgresql://$(FLYWAY_DB_HOST):$(POSTGRES_PORT)/$(POSTGRES_DB)

# Базовые опции для Flyway
FLYWAY_BASE_OPTS := -url=$(FLYWAY_URL) -user=$(POSTGRES_USER) -password=$(POSTGRES_PASSWORD)
# если используешь отдельную схему (у тебя DB_SCHEMA=pf) — добавим
ifdef DB_SCHEMA
  FLYWAY_BASE_OPTS += -defaultSchema=$(DB_SCHEMA) -schemas=$(DB_SCHEMA)
endif

FLYWAY_RUN := $(DOCKER_COMPOSE) run --rm $(FLYWAY_SVC) $(FLYWAY_BASE_OPTS)

# --- phony ---
.PHONY: up down logs wait-db migrate drop reset create recreate truncate test_data psql help

# --- compose lifecycle ---
up:
	$(DOCKER_COMPOSE) up -d --build

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f $(DB_SVC) backend frontend

# Дождаться готовности Postgres
wait-db:
	$(DOCKER_COMPOSE) exec -T $(DB_SVC) sh -c 'until pg_isready -h localhost -U "$(POSTGRES_USER)" -d "$(POSTGRES_DB)"; do sleep 1; done; echo "DB is ready"'

# --- flyway ---
migrate:
	$(FLYWAY_RUN) migrate

# clean с явным разрешением (иначе Flyway может запретить clean)
drop:
	$(DOCKER_COMPOSE) run --rm -e FLYWAY_CLEAN_DISABLED=false $(FLYWAY_SVC) $(FLYWAY_BASE_OPTS) clean

reset: drop migrate

# если нужно раскатить до первой миграции (например, создать пустую схему)
create:
	$(FLYWAY_RUN) migrate -target=1

recreate: drop create

# --- SQL скрипты внутри контейнера БД ---
truncate:
	cat $(TRUNCATE_FILE) | $(DOCKER_COMPOSE) exec -T $(DB_SVC) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

test_data:
	cat $(TEST_DATA_FILE) | $(DOCKER_COMPOSE) exec -T $(DB_SVC) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

psql:
	$(DOCKER_COMPOSE) exec $(DB_SVC) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

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
