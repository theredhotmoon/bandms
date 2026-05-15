# ──────────────────────────────────────────────────────────────────────────────
#  BandMS — Docker shortcuts
#  Usage: make <target>
# ──────────────────────────────────────────────────────────────────────────────

DC      = docker compose
BACKEND = bandms_backend

.PHONY: up down build rebuild reset logs logs-backend logs-frontend logs-mysql \
        shell migrate fresh seed passport test health

## Start all services (detached)
up:
	$(DC) up -d

## Stop all services
down:
	$(DC) down

## Build images without starting
build:
	$(DC) build

## Stop → rebuild images → start
rebuild:
	$(DC) down
	$(DC) build --no-cache
	$(DC) up -d

## Stop and remove volumes (wipes DB and stored files — irreversible)
reset:
	$(DC) down -v

## Tail logs from all services
logs:
	$(DC) logs -f

logs-backend:
	$(DC) logs -f backend

logs-frontend:
	$(DC) logs -f frontend

logs-mysql:
	$(DC) logs -f mysql

## Open a shell in the backend container
shell:
	docker exec -it $(BACKEND) sh

## Run pending migrations
migrate:
	docker exec $(BACKEND) php artisan migrate --force

## Drop all tables, re-migrate and seed
fresh:
	docker exec $(BACKEND) php artisan migrate:fresh --seed --force

## Run seeders only
seed:
	docker exec $(BACKEND) php artisan db:seed --force

## Install Passport keys & default clients (run once on a new DB)
passport:
	docker exec $(BACKEND) php artisan passport:install --no-interaction

## Clear and rebuild all caches
optimize:
	docker exec $(BACKEND) php artisan optimize:clear
	docker exec $(BACKEND) php artisan optimize

## Run the test suite
test:
	docker exec $(BACKEND) php artisan test

## Check the health endpoint
health:
	curl -s http://localhost/api/health | python3 -m json.tool
