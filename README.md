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
