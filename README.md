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

### Default login — local development only

The seeder creates this account because `docker-compose.yml` sets `ADMIN_EMAIL`
and `ADMIN_PASSWORD` for the local stack. The E2E suite logs in with it, so
don't change it without updating `app/e2e/fixtures/auth.ts` too.

| Field    | Value              |
|---|---|
| Email    | `admin@bandms.test`|
| Password | `password`         |

**Production gets no default account.** The seeder creates an admin only when
both variables are set, and `.env.prod.example` leaves them deliberately blank —
so a fresh deployment has nothing to log in with until you create it yourself:

```bash
docker exec -it bandms-backend php artisan bandms:create-admin
```

Run without `--password` and it prompts for one, so the value stays out of your
shell history. It requires at least 12 characters with letters and numbers. Store the result in a password manager — **never commit production
credentials to this repository, which is public.**

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

> **`make` is not installed on the Windows dev setup.** These targets are
> shorthand — if you get `make: command not found`, run the underlying command
> directly. The two you will want most often:
>
> ```bash
> bash scripts/test-all.sh --skip-e2e   # backend + frontend unit suites
> bash scripts/test-all.sh              # both, plus E2E (= `make test-all`)
> ```
>
> Note `--skip-e2e` is wider than `make test`, which runs the backend suite
> alone.
> `scripts/test-all.sh` returns a bitmask exit code: 1 backend, 2 E2E,
> 4 frontend. Everything else is a `docker compose` call — read `Makefile`
> for the exact command behind a target.

---

## Rebuilding containers

**Always use `rebuild.sh` — never raw `docker compose build/up`.**
The script rebuilds images, restarts containers, runs migrations, and rebuilds caches in the correct order.

```bash
bash rebuild.sh                    # full rebuild + run Pest tests (default)
bash rebuild.sh --backend-only     # fast — PHP changes only + run tests
bash rebuild.sh --fresh-db         # wipe DB + full rebuild + seed + tests
bash rebuild.sh --skip-tests       # any mode without running tests (mid-feature only)
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

#### Reading a red E2E run: check the signature, not the free-RAM number

The suite can fail for reasons that have nothing to do with the code, when the
machine cannot give Chromium and the Vite dev server the memory they ask for.
When that happens it is unmistakable, and it is **not** identified by how much
free RAM Task Manager reports:

| Reported free RAM | Result, same commit, same 2-worker config |
|---|---|
| 1.4–1.9 GB | 1–3 failures, a **different set each run** |
| 5.5 GB | 178 passed, 0 failed — 2.3 min |
| **176 MB** | **178 passed, 0 failed — 2.4 min** |

That last row is why free RAM is a weak hint rather than a threshold.
`FreePhysicalMemory` counts only *unused* pages, not reclaimable ones —
Windows can hand over compressed memory and pageable working sets on demand,
so a machine reporting 176 MB free may have gigabytes available.

**The reliable signal is the failure signature.** Suspect the machine when you
see any of:

- `FATAL ERROR: Zone Allocation failed - process out of memory` from the dev
  server — the OS refusing an allocation, *not* V8 hitting its heap cap, so
  raising `--max-old-space-size` makes it worse
- `GPU process launch failed` from Chromium
- A **different set of specs** failing each run, or a spec your change cannot
  reach (a heading-visibility assertion cannot regress from a backend edit)
- Failures arriving as 30-second timeouts rather than assertion mismatches

Triage order:

1. **Do the failing specs relate to your change?** A different set each run
   means the machine, whatever the memory reading says.
2. **Look for the signatures above** in the output.
3. **Only then investigate the specs.**

If it is the machine, closing browser windows is usually enough. `workers` is
pinned to 2 in `app/playwright.config.ts`; override with
`pnpm test:e2e --workers=4` when there is room.

A full green run reports **178 passed, 15 skipped**. The 15 are intentional
data-dependent guards in the specs, not silent failures.

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
├── web/                    # Astro 5 public site (static, built at container start)
│   ├── src/lib/            # cms.ts, slugs.ts — what gets built and where links point
│   ├── src/themes/         # Per-band theme overrides of the base look
│   └── src/styles/         # tokens.css = the semantic contract themes may override
├── scripts/
│   ├── ship.sh             # Full ship pipeline
│   └── test-all.sh         # Run unit + E2E suites
├── rebuild.sh              # Docker rebuild script
├── Makefile                # All dev shortcuts
└── CHANGELOG.md            # Auto-updated by ship.sh
```

---

## Public site URLs come from the CMS

Every website module carries its own URL slug **per locale**, stored in the CMS
and served by `GET /api/site-config?lang=xx`. The public site reads them in
`web/src/lib/slugs.ts` — it never derives a URL from a module's label.

| Change in `/admin/website-modules` | Effect on the URL |
|---|---|
| Custom name (label) | none — nav text only |
| Custom slug | **moves the page**; old links 404 |

That split is the point: slugs used to be derived from the label, so renaming
"Shop" to "Merch store" silently moved `/en/shop` and broke every inbound link.
An empty slug serves the module under its key — `videos` stays at `/en/videos`
however it is labelled.

### If the Polish URLs look wrong after a deploy

The slug map is resolved **once per build** and shared by everything that uses
it — the routes Astro generates, and the links the header and footer emit. If
the API is unreachable it retries; if all three attempts fail, the build falls
back to module keys for the **whole site** (`/pl/shop` instead of `/pl/sklep`)
and logs a warning:

```bash
docker logs bandms_web 2>&1 | grep '\[slugs\]'
# [slugs] site-config unreachable after 3 attempts — falling back to module keys for every URL.
```

**That line means the build could not reach the API — it does not mean anyone
changed a slug.** Don't go looking in the CMS; once the API is healthy, rebuild
the site:

```bash
docker compose restart web        # content/config refresh only — no source changes
```

Shipping consistent-but-wrong URLs is deliberate. The alternatives are worse: a
build that fails takes the entire public site down (`start.sh` exits, the
container crash-loops), and a map that changes mid-build would generate routes
at one path while every nav link points at another — dead links on a build that
reports success.

---

## Maps: venue coordinates and the CARTO basemap key

The concert map needs **two independent things** to be true. Miss either and you
get a different, equally confusing symptom.

| Missing | Symptom |
|---|---|
| Venue coordinates | The map section is **absent** — no empty box, no error |
| `PUBLIC_CARTO_KEY` | The map draws, but every tile reads **"API KEY REQUIRED"** |

### The key

CARTO gated their raster basemaps. An unkeyed tile request still returns
`200 OK` with a valid PNG — it is simply watermarked across the middle. Nothing
else can see that: the network tab is green, Leaflet raises nothing, and both
`astro build` and `vue-tsc` pass. **The only symptom is visual**, which is why
this reads as a broken map rather than a missing credential.

Request a key at <https://carto.com/basemaps/apikey> — email, the domain you
will serve from, and a line on what you are building. It is emailed straight
back with no approval queue and no CARTO account, free to 5M tile requests a
month. Put it in the root `.env`:

```bash
PUBLIC_CARTO_KEY=<the key CARTO emails you>
```

One variable, two consumers: the public site reads it as `PUBLIC_CARTO_KEY`
(Astro only exposes `PUBLIC_`-prefixed vars to island code), and the admin SPA
takes it as a `VITE_CARTO_KEY` **build arg**, wired in `docker-compose.yml`.

It is **inlined into client JavaScript at build time**, so changing it needs a
rebuild — a restart will not do:

```bash
docker compose build web frontend && docker compose up -d web frontend
```

The key is public by design. It travels in the tile URL and ships in the bundle;
a basemap key is a domain-scoped credential, not a secret — do not add a proxy
to hide it.

With no key set the site still requests CARTO tiles rather than silently falling
back to another provider. That keeps the watermark visible on purpose: a deploy
missing the key should *look* wrong rather than quietly render a different
basemap than production does.

### Venue coordinates

`ConcertsSection.astro` filters on `concertsWithCoords`, so a venue with no
`latitude`/`longitude` is not merely a missing pin — if *no* venue has
coordinates the entire map section is omitted from the build. That is why an
un-geocoded database shows no map at all rather than an empty one.

Two ways to fill them in:

- **One venue** — `/admin/venues`, open the venue, use the place search or click
  the map to drop a pin. Address fields are auto-filled from the search result.
- **In bulk** — for rows imported or seeded before anyone thought about the map:

```bash
docker exec bandms_backend php artisan venues:geocode --dry-run   # preview
docker exec bandms_backend php artisan venues:geocode --force     # write
```

It geocodes from the address, never the venue name: a name helps for a landmark
and actively hurts for anything generic ("Klub Studio"), and a confident pin in
the wrong city is worse than no pin — nobody thinks to double-check it. Review
the `--dry-run` table before committing.

Queries are memoised per address, so venues sharing a city cost one request
between them, and lookups are spaced a second apart per Nominatim's usage
policy. `--force` skips the production confirmation; the local backend container
runs with `APP_ENV=production`, so you need it there too.

After writing coordinates, rebuild the public site so the new pins are baked in:

```bash
docker compose restart web        # content-only refresh
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
| `PUBLIC_CARTO_KEY` | CARTO basemap key for the concert maps — see [Maps](#maps-venue-coordinates-and-the-carto-basemap-key) |

### Changing an environment variable on the server

**The deploy never writes `/opt/bandms/.env`.** `.github/workflows/deploy.yml`
copies only `docker-compose.prod.yml`, `docker/caddy/Caddyfile` and
`scripts/prod-backup-db.sh`; the server's `.env` is persistent state you edit by
hand. Adding a variable to `.env.example` therefore changes nothing in
production until you also add it there.

**A variable set only in `.env` does nothing either.** The `backend` and `web`
services declare explicit `environment:` maps and take no `env_file`, so a value
reaches a container only where the compose file interpolates it. If it is not
listed in `docker-compose.prod.yml`, it is simply absent and the app falls back
to a config default — silently.

So a variable needs **both**: a line in the server's `.env`, and a line in the
service's `environment:` block (which ships from the repo).

#### 1. Work out which kind of variable it is

| Kind | Examples | Where it is consumed | To apply |
|---|---|---|---|
| Backend runtime | `FRONTEND_URL`, `LOGIN_RATE_LIMIT`, `CONTACT_EMAIL` | Laravel config, cached by `php artisan optimize` at container start | Recreate `backend` |
| Public-site build | `PUBLIC_THEME`, `PUBLIC_CARTO_KEY` | `web/docker/start.sh`, passed to `astro build` when the container starts | Recreate `web` |
| Admin SPA build | `VITE_*` | Baked into the image by CI at `docker build` time | **Cannot be set on the server** — needs a CI change |

That last row is a real limit, not an oversight. The `frontend` image is pulled
prebuilt from GHCR with no build args, so `VITE_CARTO_KEY` has no effect in
production. It does not need one: Caddy's `@spa` matcher does not route
`/concerts` to the SPA, so the SPA's map never reaches a visitor.

#### 2. Edit the server's `.env`

```bash
ssh deploy@YOUR_SERVER
cd /opt/bandms
cp .env .env.bak.$(date +%F)          # cheap insurance
nano .env                             # add or change the line
grep PUBLIC_CARTO_KEY .env            # confirm it is there
```

#### 3. Recreate the affected container — a restart is not enough

`entrypoint.sh` runs `php artisan optimize`, which bakes env values into the
config cache for the container's lifetime; `start.sh` reads its env once at
startup. `docker compose restart` reuses the existing container **with its old
environment**, so it reports success and changes nothing.

```bash
# public site (rebuilds the Astro site on start — takes 1–2 min)
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate web

# backend
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend
```

#### 4. Verify the value actually arrived

Do not trust `.env`. Ask the container:

```bash
docker exec bandms-backend printenv FRONTEND_URL LOGIN_RATE_LIMIT
docker exec bandms-web printenv PUBLIC_CARTO_KEY PUBLIC_THEME
```

Empty output means the variable never arrived — almost always a missing line in
the service's `environment:` block, not a typo in `.env`.

For `PUBLIC_CARTO_KEY` specifically, the value is compiled into the site's
JavaScript, so the real check is the served bundle:

```bash
# which map island the page actually loads
curl -s https://YOUR_DOMAIN/en/concerts | grep -o '/_astro/ShowsMap[^"]*\.js' | head -1

# 1 = the key is baked into that bundle, 0 = it is not
curl -s https://YOUR_DOMAIN/_astro/ShowsMap.<hash>.js | grep -c 'key='
```

Then load the page and *look at it* — an unkeyed tile still returns `200 OK`, so
only your eyes can confirm the watermark is gone.

#### A note on the Caddyfile

`docker/caddy/Caddyfile` is a bind mount, and Compose hashes the *service
definition* — not a mounted file's contents — when deciding whether to recreate.
A changed Caddyfile is reported up-to-date and skipped, and Caddy parses its
config only at startup. The tell is `docker ps` showing `bandms-caddy` with a far
older uptime than everything around it. Validate before recreating, because a
malformed file takes down the whole site:

```bash
docker run --rm -e SITE_ADDRESS=":80" \
  -v /opt/bandms/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate caddy
```

A manual server-side edit is a **hotfix, not a fix** — the next deploy `scp`s the
repo's copy over it. Land the same change in the repo.


---

## Logs reference

| File | Written by | Contents |
|---|---|---|
| `ship.log` | `scripts/ship.sh` | Full ship pipeline output |
| `rebuild.log` | `rebuild.sh` | Docker rebuild steps and timing |
| `unit-test.log` | `scripts/test-all.sh` | Last Pest run output |
| `e2e-test.log` | `scripts/test-all.sh` | Last Playwright run output |

When something breaks, share the relevant log file with Claude: `cat ship.log`
