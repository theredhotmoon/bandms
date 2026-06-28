# ──────────────────────────────────────────────────────────────────────────────
#  BandMS — Docker shortcuts
#  Usage: make <target>
# ──────────────────────────────────────────────────────────────────────────────

DC      = docker compose
BACKEND = bandms_backend

# Read .env values for test targets
_APP_KEY     := $(shell grep '^APP_KEY=' .env | cut -d= -f2-)
_DB_USERNAME := $(shell grep '^DB_USERNAME=' .env | cut -d= -f2-)
_DB_PASSWORD := $(shell grep '^DB_PASSWORD=' .env | cut -d= -f2-)

.PHONY: up down build rebuild reset logs logs-backend logs-frontend logs-mysql logs-web \
        shell migrate fresh seed passport test test-build test-all ship health \
        web-dev web-build

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

logs-web:
	$(DC) logs -f web

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
## Uses passport:keys + passport:client directly to avoid passport:install
## publishing duplicate migration files into database/migrations/.
passport:
	docker exec $(BACKEND) php artisan passport:keys --no-interaction
	docker exec $(BACKEND) php artisan passport:client --personal --name="BandMS Personal" --no-interaction
	docker exec $(BACKEND) php artisan passport:client --password  --name="BandMS Password" --no-interaction

## Clear and rebuild all caches
optimize:
	docker exec $(BACKEND) php artisan optimize:clear
	docker exec $(BACKEND) php artisan optimize

## Build the test Docker image (run once; cached on repeat runs)
test-build:
	docker build --target test -t bandms_test ./api

## Run the test suite (SQLite in-memory, no MySQL needed)
test: test-build
	docker run --rm \
		-e APP_ENV=testing \
		-e APP_KEY=$(_APP_KEY) \
		bandms_test

## Run all test suites (unit + E2E). Options: SKIP_E2E=1  SKIP_UNIT=1
test-all:
	bash scripts/test-all.sh $(if $(SKIP_E2E),--skip-e2e) $(if $(SKIP_UNIT),--skip-unit)

## Full ship pipeline: rebuild? → tests → changelog → branch → commit → push → PR
## Options: REBUILD=1  REBUILD_BACKEND=1  REBUILD_FRESH=1  SKIP_E2E=1  SKIP_UNIT=1  DRY_RUN=1  NO_PR=1
ship:
	bash scripts/ship.sh \
		$(if $(REBUILD),--rebuild) \
		$(if $(REBUILD_BACKEND),--rebuild-backend) \
		$(if $(REBUILD_FRESH),--rebuild-fresh) \
		$(if $(SKIP_E2E),--skip-e2e) \
		$(if $(SKIP_UNIT),--skip-unit) \
		$(if $(DRY_RUN),--dry-run) \
		$(if $(NO_PR),--no-pr) \
		$(if $(BRANCH),--branch $(BRANCH)) \
		-y

## Start Astro dev server (pnpm dev in web/, proxies /api to localhost:80)
web-dev:
	cd web && pnpm dev

## Build the Astro static site locally (requires API_BASE to be set)
web-build:
	cd web && pnpm build

## Check the health endpoint
health:
	curl -s http://localhost/api/health | python3 -m json.tool
