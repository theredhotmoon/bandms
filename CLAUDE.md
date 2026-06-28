# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository layout

This is a monorepo with two applications:

| Directory | Role |
|---|---|
| `api/` | Laravel 11 REST API (backend) |
| `app/` | Vue 3 + TypeScript SPA (frontend) |

Frontend-specific conventions live in `app/CLAUDE.md`.

---

## Development commands

All shortcuts run from the **monorepo root** via `make`:

```bash
make up          # Start all Docker containers (detached)
make down        # Stop all containers
make build       # Build images without starting
make rebuild     # Stop → rebuild --no-cache → start
make reset       # Stop + wipe volumes (fresh DB — irreversible)
make shell       # Open shell in backend container
make migrate     # Run pending migrations
make fresh       # Drop all tables, re-migrate, seed
make seed        # Run seeders only
make passport    # Install Passport OAuth keys & clients (once per fresh DB)
make test        # Run the backend test suite
make health      # Hit /api/health
make logs        # Tail all service logs
make logs-backend / logs-frontend / logs-mysql
```

Run a single test from inside the container:

```bash
docker exec bandms_backend php artisan test --filter TestClassName
docker exec bandms_backend php artisan test --filter TestClassName::test_method
```

### Frontend dev server (`app/`)

```bash
cd app
pnpm dev       # Vite dev server on :5173 (proxies /api/* → backend)
pnpm build     # Type-check + production build
pnpm preview   # Serve the production build
```

---

## Architecture

### Backend (`api/` — Laravel REST API)

- **Routes** (`routes/api.php`) — public read-only GETs; rate-limited auth endpoints; Passport-guarded CRUD
- **Controllers** (`app/Http/Controllers/`) — thin, delegate to Eloquent; one controller per resource
- **Resources** (`app/Http/Resources/`) — all JSON shaping happens here; `*Summary` variant for list responses
- **Models** (`app/Models/`) — Eloquent ORM; relationships declared here
- **Database** — MySQL 8.4 via Docker; migrations in `database/migrations/`

Authentication uses **Laravel Passport** (OAuth2 Bearer tokens). Protected routes require `auth:api` middleware.

### Frontend (`app/` — Vue 3 SPA)

```
src/api/          # Fetch functions — one file per API resource, no state
src/types/        # TypeScript interfaces — one file per domain entity
src/composables/  # All reactive/stateful logic (TanStack Query lives here)
src/components/   # Presentational components
src/views/        # Thin route-level orchestrators (≤ ~50 template lines)
src/router/       # Routes + global navigation guard
```

Server state is managed with **TanStack Query v5**.

### API contract

The frontend proxies `/api/*` to the backend container. The backend exposes:

- `GET /api/{resource}` — public read-only
- `POST /api/auth/{register,login,logout}` — rate-limited
- `POST|PUT|DELETE /api/{resource}` — requires Passport Bearer token

---

## Key environment setup

Copy `.env.example` to `.env` at the monorepo root before first run. After `make up`, run `make passport` once to generate OAuth keys and the default client credentials.

---

## Docker image rebuilds

**Always use `rebuild.sh` — never run raw `docker compose build/up` commands directly.**
The script rebuilds images, restarts containers, runs migrations, and rebuilds caches in the correct order. It prints a per-step summary with timing so failures are immediately obvious.

```bash
# After adding/changing PHP files (most common):
bash rebuild.sh --backend-only          # fast — rebuild backend + run tests

# After changing frontend Dockerfile or docker-compose.yml:
bash rebuild.sh                         # full rebuild + run tests

# Full reset (wipes DB):
bash rebuild.sh --fresh-db              # prompts for confirmation + run tests

# Skip tests (mid-feature, intentionally broken):
bash rebuild.sh --backend-only --skip-tests
```

The script writes a full log to `rebuild.log` in the project root.

---

## Git workflow — always use a feature branch

**At the start of every new conversation that will produce a commit, create a feature branch immediately.**
Never commit directly to `main`.

```bash
git checkout main && git pull          # start from latest main
git checkout -b feature/<short-name>   # e.g. feature/social-links-editor
```

- Branch name: `feature/<kebab-description>` for features, `fix/<kebab-description>` for bug fixes.
- Keep one branch per conversation / logical unit of work.
- Open a PR when the work is ready; use `make ship` or `gh pr create` to ship.
- Merge via GitHub PR — never `git merge` directly into main locally.

---

## Quality standard — tests run by default

**Always run the full test suite before reporting a feature done or before shipping.**
Quality over speed: a feature that breaks existing tests is not done, even if it works visually.

```bash
make test        # backend unit tests (Pest, ~15 s) — run after every backend change
make test-all    # unit + E2E Playwright — run before shipping
```

- Run `make test` automatically after any backend change (models, controllers, migrations, resources).
- Run `make test-all` before every `/ship` or PR.
- Skip only when explicitly told to ("don't run tests" / "quick change") — and say so in the response.
- If tests fail after your change: fix them before reporting done. Distinguish between a **code bug** (fix the source) and a **test bug** (test is outdated — fix the test and explain why).
- **Rebuilds run tests by default.** Use `--skip-tests` to skip them when you're mid-feature and the suite is intentionally broken.
