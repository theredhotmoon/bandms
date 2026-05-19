# BandMS

Music career management system — EPK, smart links, releases, concerts, pitching, and more.

## Quick start

```bash
cp .env.example .env
docker compose up -d
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --force
docker compose exec backend php artisan passport:install
```

Frontend runs at **http://localhost:8081**

## Login credentials (after seeding)

| Field    | Value              |
|----------|--------------------|
| Email    | `test@example.com` |
| Password | `password`         |

## Development commands

| Command                  | Description                        |
|--------------------------|------------------------------------|
| `docker compose up -d`   | Start all containers               |
| `docker compose down`    | Stop all containers                |
| `docker compose exec backend php artisan migrate` | Run migrations |
| `docker compose exec backend php artisan db:seed` | Run seeders    |
| `docker compose exec backend php artisan test`    | Run test suite |

Frontend dev server (hot reload on :5173):

```bash
cd app
pnpm dev
```

## rebuild.sh
The option flag works with all three modes:

  rebuild.sh --run-tests                      # full rebuild + tests
  rebuild.sh --backend-only --run-tests       # fast PHP rebuild + tests
  rebuild.sh --fresh-db --run-tests           # wipe DB, full rebuild + tests

What it does when --run-tests is set:
1. Builds the bandms_test Docker image from the updated ./api source (the test stage of the Dockerfile)
2. Runs docker run --rm with just APP_KEY — SQLite in-memory, self-contained, no MySQL needed
3. If any test fails, set -euo pipefail triggers the error trap, marks "Running Pest test suite" as ✖ in the step summary, and exits non-zero — so the rebuild is reported as failed