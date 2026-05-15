# ──────────────────────────────────────────────
#  BandMS Service — Dev helpers
# ──────────────────────────────────────────────

SAIL = ./vendor/bin/sail
DOCKER_COMPOSE = docker compose -f compose.yaml
WWWUSER ?= 1000
WWWGROUP ?= 1000

.PHONY: up down restart shell logs migrate fresh seed passport test build ps

## Start all containers in the background
up:
	WWWUSER=$(WWWUSER) WWWGROUP=$(WWWGROUP) $(DOCKER_COMPOSE) up -d

## Stop all containers
down:
	WWWUSER=$(WWWUSER) WWWGROUP=$(WWWGROUP) $(DOCKER_COMPOSE) down

## Stop containers and remove volumes (fresh DB)
reset:
	WWWUSER=$(WWWUSER) WWWGROUP=$(WWWGROUP) $(DOCKER_COMPOSE) down -v

## Restart all containers
restart:
	WWWUSER=$(WWWUSER) WWWGROUP=$(WWWGROUP) $(DOCKER_COMPOSE) restart

## Rebuild Docker image
build:
	WWWUSER=$(WWWUSER) WWWGROUP=$(WWWGROUP) $(DOCKER_COMPOSE) up -d --build

## Show running containers
ps:
	docker compose -f compose.yaml ps

## Open a shell inside the app container
shell:
	docker exec -it bandms-app bash

## Tail all container logs
logs:
	$(DOCKER_COMPOSE) logs -f

## Run database migrations
migrate:
	docker exec bandms-app php artisan migrate

## Drop all tables and re-run all migrations
fresh:
	docker exec bandms-app php artisan migrate:fresh --seed

## Run seeders
seed:
	docker exec bandms-app php artisan db:seed

## Install Passport keys & clients (run once after migrate)
passport:
	docker exec bandms-app php artisan passport:install

## Run the test suite
test:
	docker exec bandms-app php artisan test

## Check the health endpoint
health:
	curl -s http://localhost:8080/api/health | python3 -m json.tool
