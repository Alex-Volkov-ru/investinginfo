include .env
export $(shell sed 's/=.*//' .env)

DOCKER_COMPOSE = docker compose

migrate:
	$(DOCKER_COMPOSE) run --rm cli-flyway

up:
	$(DOCKER_COMPOSE) up -d --build

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f db backend frontend
