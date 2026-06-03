# BandMS

Music career management system — EPK, smart links, releases, concerts, pitching, and more.

## Stack

| Layer | Technology |
|---|---|
| Backend | Laravel 11 · PHP 8.3 · MySQL 8.4 |
| Frontend | Vue 3 · TypeScript · Vite · Tailwind CSS v4 |
| Auth | Laravel Passport (OAuth2 Bearer tokens) |
| Server state | TanStack Query v5 |
| E2E tests | Playwright 1.60 |
| Containers | Docker Compose |

---

## Quick start

```bash
cp .env.example .env        # fill in APP_KEY, DB_* values
make up                     # start all containers (detached)
make migrate                # run pending migrations
make seed                   # seed the database
make passport               # install OAuth keys (once per fresh DB)
```

Frontend dev server (hot reload on **:5173**, proxies `/api/*` to backend):

```bash
cd app && pnpm dev
```

App is then available at:
- **Frontend (Vite):** http://localhost:5173
- **Backend API:** http://localhost/api

### Default login (after seeding)

| Field    | Value              |
|---|---|
| Email    | `test@example.com` |
| Password | `password`         |

---

## Make commands

Run from the project root. Always prefer these over raw `docker compose` commands.

| Command | Description |
|---|---|
| `make up` | Start all containers (detached) |
| `make down` | Stop all containers |
| `make build` | Build images without starting |
| `make rebuild` | Stop → rebuild (no-cache) → start |
| `make reset` | Stop + wipe volumes — **irreversible** |
| `make shell` | Open shell in backend container |
| `make migrate` | Run pending migrations |
| `make fresh` | Drop all tables, re-migrate, seed |
| `make seed` | Run seeders only |
| `make passport` | Install Passport OAuth keys and clients |
| `make test` | Run backend unit test suite (Pest) |
| `make test-all` | Run unit + E2E tests |
| `make ship` | Full ship pipeline (see [Shipping](#shipping)) |
| `make logs` | Tail all service logs |
| `make health` | Hit `/api/health` |

---

## Rebuilding containers

**Always use `rebuild.sh` — never raw `docker compose build/up`.**
The script rebuilds images, restarts containers, runs migrations, and rebuilds caches in the correct order.

```bash
bash rebuild.sh                    # full rebuild (all images)
bash rebuild.sh --backend-only     # fast — PHP changes only
bash rebuild.sh --fresh-db         # wipe DB + full rebuild + seed (prompts for confirmation)
bash rebuild.sh --run-tests        # any mode + run Pest suite after rebuild
```

Output is tee'd to **`rebuild.log`** — share it with Claude if anything fails.

---

## Testing

### Backend unit tests (Pest)

```bash
make test                          # runs inside Docker (SQLite, no MySQL needed)
```

Or from inside the backend container:

```bash
docker exec bandms_backend php artisan test
docker exec bandms_backend php artisan test --filter TagTest
docker exec bandms_backend php artisan test --filter TagTest::test_method
```

### E2E tests (Playwright)

Requires the backend Docker stack to be running (`make up`) and a valid admin account.

```bash
# Set credentials (or add to .env)
export E2E_ADMIN_EMAIL=test@example.com
export E2E_ADMIN_PASSWORD=password

cd app
pnpm test:e2e                      # headless, Chromium only
pnpm test:e2e:headed               # visible browser window
pnpm test:e2e:ui                   # interactive Playwright UI
pnpm test:e2e -- --grep "Tags"     # run a specific spec
pnpm test:e2e:report               # open last HTML report
```

Playwright auto-starts the Vite dev server before running tests.
Auth state is saved to `app/e2e/.auth/admin.json` and reused across tests.

### Run both suites together

```bash
make test-all                      # unit + E2E
make test-all SKIP_E2E=1           # unit only
make test-all SKIP_UNIT=1          # E2E only
```

Logs are written to **`unit-test.log`** and **`e2e-test.log`** on failure.

---

## Shipping

The ship pipeline runs all tests, updates the changelog, and opens a PR.

### Via script (no Claude needed)

```bash
bash scripts/ship.sh               # interactive — asks about Docker rebuild
bash scripts/ship.sh -y            # non-interactive (no rebuild, tests → changelog → PR)
bash scripts/ship.sh --rebuild-backend -y   # rebuild backend first
bash scripts/ship.sh --rebuild -y          # full Docker rebuild first
bash scripts/ship.sh --dry-run -y          # tests + changelog only, no git ops
```

All output is tee'd to **`ship.log`**. On failure, the last lines are printed inline and the full log is at `ship.log`.

```bash
# If something fails — share the log with Claude
cat ship.log
```

Available flags:

| Flag | Effect |
|---|---|
| `--rebuild` | Full Docker rebuild before tests |
| `--rebuild-backend` | Backend-only rebuild (fast, for PHP changes) |
| `--rebuild-fresh` | Fresh DB rebuild — **wipes database** |
| `--skip-unit` | Skip Pest unit tests |
| `--skip-e2e` | Skip Playwright E2E tests |
| `--skip-changelog` | Skip CHANGELOG.md update |
| `--dry-run` | Tests + changelog only, no git operations |
| `--no-pr` | Commit + push, but don't create a PR |
| `--branch <name>` | Override auto-generated branch name |
| `-y` / `--yes` | Non-interactive (skip rebuild prompt) |

### Via make

```bash
make ship                          # interactive
make ship REBUILD_BACKEND=1        # fast rebuild + tests + PR
make ship SKIP_E2E=1               # unit only + PR
make ship DRY_RUN=1 SKIP_UNIT=1    # dry run, E2E only
```

### Via `/ship` Claude skill

Type `/ship` in any Claude Code session. Claude will:
1. Ask if the feature is complete and which rebuild mode (if any)
2. Run all tests, fix any failures
3. Write a proper CHANGELOG entry
4. Create a branch, commit, push, and open a PR

The skill lives at `~/.claude/skills/ship.skill` and works in any project.

---

## Project structure

```
bandms/
├── api/                    # Laravel 11 backend
│   ├── app/Http/           # Controllers, Resources, Middleware
│   ├── database/           # Migrations, Seeders, Factories
│   ├── routes/api.php      # All API routes
│   └── tests/Feature/      # Pest feature tests (730+ tests)
├── app/                    # Vue 3 frontend
│   ├── src/
│   │   ├── api/            # Fetch functions (one file per resource)
│   │   ├── composables/    # TanStack Query + reactive logic
│   │   ├── components/     # Presentational components
│   │   ├── views/admin/    # Admin panel views
│   │   └── router/         # Routes + auth guards
│   └── e2e/                # Playwright E2E tests
│       ├── fixtures/       # Auth setup + shared helpers
│       └── tests/admin/    # 20 admin panel spec files (179 tests)
├── scripts/
│   ├── ship.sh             # Full ship pipeline
│   └── test-all.sh         # Run unit + E2E suites
├── rebuild.sh              # Docker rebuild script
├── Makefile                # All dev shortcuts
└── CHANGELOG.md            # Auto-updated by ship.sh
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `APP_KEY` | Laravel app key (`php artisan key:generate`) |
| `DB_DATABASE` | MySQL database name |
| `DB_USERNAME` / `DB_PASSWORD` | MySQL credentials |
| `E2E_ADMIN_EMAIL` | Admin email used by Playwright tests |
| `E2E_ADMIN_PASSWORD` | Admin password used by Playwright tests |
| `E2E_BASE_URL` | Override Playwright base URL (default: `http://localhost:5173`) |

---

## Logs reference

| File | Written by | Contents |
|---|---|---|
| `ship.log` | `scripts/ship.sh` | Full ship pipeline output |
| `rebuild.log` | `rebuild.sh` | Docker rebuild steps and timing |
| `unit-test.log` | `scripts/test-all.sh` | Last Pest run output |
| `e2e-test.log` | `scripts/test-all.sh` | Last Playwright run output |

When something breaks, share the relevant log file with Claude: `cat ship.log`
