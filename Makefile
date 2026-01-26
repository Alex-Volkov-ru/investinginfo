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
.PHONY: up down logs wait-db migrate drop reset create recreate truncate test_data psql backup-list backup-restore backup-create help

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

# --- backups ---
BACKUP_DIR ?= ./backups
BACKUP_FILE ?=

backup-list:
	@echo "Available backups:"
	@ls -lh $(BACKUP_DIR)/backup_*.sql.gz 2>/dev/null | awk '{print $$9, "(" $$5 ")"}' || echo "No backups found"

backup-restore:
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "ERROR: Specify BACKUP_FILE=backup_YYYYMMDD_HHMMSS.sql.gz"; \
		echo "   Example: make backup-restore BACKUP_FILE=backup_20260126_140944.sql.gz"; \
		exit 1; \
	fi
	@echo "WARNING: This will overwrite all data in the database!"
	@echo "Restoring from backup: $(BACKUP_FILE)"
	@if [ ! -f "$(BACKUP_DIR)/$(BACKUP_FILE)" ]; then \
		echo "ERROR: Backup file not found: $(BACKUP_DIR)/$(BACKUP_FILE)"; \
		exit 1; \
	fi
	@if echo "$(BACKUP_FILE)" | grep -q "\.gz$$"; then \
		echo "Decompressing backup..."; \
		gunzip -c "$(BACKUP_DIR)/$(BACKUP_FILE)" | $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) exec -T $(DB_SVC) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB); \
	else \
		cat "$(BACKUP_DIR)/$(BACKUP_FILE)" | $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) exec -T $(DB_SVC) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB); \
	fi
	@echo "SUCCESS: Database restored from: $(BACKUP_FILE)"

backup-create:
	@if [ -z "$(TOKEN)" ]; then \
		echo "ERROR: TOKEN is required"; \
		echo "   Usage: make backup-create TOKEN=your_jwt_token"; \
		echo "   Or via Swagger UI: http://localhost:8000/docs"; \
		exit 1; \
	fi
	@echo "Creating backup via API..."
	@curl -X POST http://localhost:8000/backups/create \
		-H 'accept: application/json' \
		-H 'Authorization: Bearer $(TOKEN)' \
		-d '' | python -m json.tool || echo "Failed to create backup"

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
	@echo ''
	@echo '--- Backups ---'
	@echo 'make backup-list        - show list of available backups'
	@echo 'make backup-restore     - restore DB from backup (BACKUP_FILE=backup_YYYYMMDD_HHMMSS.sql.gz)'
	@echo 'make backup-create      - create backup via API (TOKEN=your_jwt_token)'
