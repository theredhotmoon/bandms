# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository layout

This is a monorepo with two applications:

| Directory | Role |
|---|---|
| `api/` | Laravel 11 REST API (backend) |
| `app/` | Vue 3 + TypeScript SPA (**admin only** — see below) |
| `web/` | Astro SSG public site — everything a visitor sees |
| `packages/rider-core/` | Tech-rider domain code shared by `app/` and `web/` |

`app/`, `web/` and `packages/*` are one **pnpm workspace** (`pnpm-workspace.yaml`)
with a single root lockfile. Install from the repo root: a `pnpm install` inside
`app/` or `web/` alone will not link `@bandms/rider-core`.

**Both frontend images build from the repo root**, not from their own directory
— `docker-compose.yml` and `.github/workflows/deploy.yml` set `context: .` with
`file: app/Dockerfile` / `web/Dockerfile`. A context scoped to `app/` or `web/`
cannot see `packages/`, which is where their shared dependency lives. The root
`.dockerignore` is what keeps that context small; the member `.dockerignore`
files were deleted, because Docker only ever reads one from the context root.

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

Run a single test:

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter WebsiteModuleTest
```

Everything after the image name is passed through to `artisan test`, so
`--filter` takes a class name or any substring of a Pest `it(...)` description:
`--filter 'honours "0" as a slug'`.

**Not `docker exec bandms_backend php artisan test`.** The running backend image
is built `--no-dev` with `APP_ENV=production`, so Pest and PHPUnit are not in its
`vendor/bin` and the command dies with `Command "test" is not defined`. Tests run
in the separate `--target test` stage (`api/Dockerfile`), which layers the dev
dependencies on top and swaps in a php-cli entrypoint. That stage also builds its
own `.env` and runs against **SQLite in-memory**, so it needs neither MySQL nor a
running stack.

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

## The front door: one port in dev, same as production

**`http://localhost:8081` is the whole site.** Caddy sits in front of everything
in *both* environments and mounts the same `docker/caddy/Caddyfile`:

| URL | Container |
|---|---|
| `localhost:8081/` | `web` — Astro public site |
| `localhost:8081/admin` | `frontend` — Vue admin SPA |
| `localhost:8081/api/*` | `backend` — Laravel |

`frontend` (8082) and `web` (4322) still publish their own ports so a single
container can be debugged in isolation. **Production does not do that** — there,
only Caddy is reachable.

**Dev had no Caddy until Sep 2026, and that cost real time.** The two containers
sat on naked ports, so no local URL behaved the way the deployed site does.
After #65 deleted the SPA's public views, `:8081` — the *admin* container —
served an empty shell with a lone "Sign in" link, and that read as the public
site having been destroyed. Nothing was wrong; the port was.

**So: when a page looks blank or empty, establish which container answered
before touching code.** `curl -s localhost:8081/ | head` and
`docker compose ps` settle it in seconds.

### Moving the admin panel — `ADMIN_PATH`

The **entire** admin surface sits behind one configurable segment, default
`admin`, which reproduces the historical URLs exactly. Setting
`ADMIN_PATH=backstage` moves every admin route, and `/admin` then 404s through
Astro like any other page that was never built.

**There is no `/login` route.** The panel root renders the sign-in form when
signed out and the dashboard when signed in — `app/src/views/admin/AdminEntry.vue`.
A dedicated login URL is the thing a scanner looks for, and it announces that an
admin exists even when the panel has been moved, so it was removed rather than
renamed. `LoginView.vue` is gone; don't reintroduce it.

**Three consumers must agree, and they load the value at different times:**

| Consumer | Reads | Changing it needs |
|---|---|---|
| `docker/caddy/Caddyfile` | `{$ADMIN_PATH:admin}` at container start | `up -d --force-recreate caddy` |
| Vue SPA | `VITE_ADMIN_PATH`, **baked at image build** | `docker compose build frontend` |
| `app/src/config/admin.ts` | normalises both | — |

**A restart is not enough for the SPA half.** Caddy picking up a new prefix while
the frontend image still holds the old one routes the URL to a bundle that knows
nothing about it: the panel renders *nothing*, with no error anywhere. In
production the frontend is a prebuilt GHCR image, so moving the admin path there
means rebuilding through CI — set the `ADMIN_PATH` repository **variable**, which
`deploy.yml` passes as the `VITE_ADMIN_PATH` build arg.

**Never build an admin URL by hand.** `adminUrl()` from `@/config/admin` is the
only correct source; a literal `/admin/...` string is a link that breaks the
moment anyone sets the variable. The router, `AdminLayout`'s nav groups,
`App.vue`'s chrome check and the 401 handler in `api/client.ts` all go through it.

**Pick a segment no public page uses.** `ADMIN_PATH` shares a URL namespace
with the Astro section slugs, and Caddy matches it *first* — setting it to
`shop` or `kontakt` silently shadows that public page for every visitor. The
module-slug uniqueness check in the admin does not know about this value, so
nothing warns you.

**This is obscurity, not access control.** It cuts automated scanning of
`/login`. The auth guard and the rate limit on `/api/auth/login` are what
actually stop anyone getting in — neither changed.

**The public footer no longer links to the admin.** It did, on every page, which
published the URL site-wide and made the whole feature worthless. If you re-add
a link there, you are opting the band out of this.

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

## Known footguns

### `web` container: nav links redirect to port 80 after rebuild

**Symptom:** Clicking any nav link (e.g. `/concerts`) on `localhost:4322` redirects to `http://localhost/concerts/` (port 80, the Vue SPA).

**Root cause:** `try_files $uri $uri/ ...` makes Nginx issue a **301 permanent redirect** to add a trailing slash (e.g. `/concerts` → `Location: /concerts/`). Nginx builds the Location with `$host` (no port), so `localhost:4322` becomes `localhost` — redirecting to port 80 (the Vue SPA). Worse, browsers cache 301s forever, so clearing Nginx config alone doesn't help once a browser has seen the bad redirect.

**Fix (already applied):** `try_files $uri $uri/index.html $uri.html =404;` in `web/docker/nginx.conf`. This serves `concerts/index.html` directly for both `/concerts` and `/concerts/` — **no redirect is issued at all**, so there is nothing to cache. The `absolute_redirect off;` directive is kept as a defence-in-depth guard.

**If the browser still redirects after rebuilding:** The old 301 is cached. Open an incognito window or clear site data for `localhost:4322` in DevTools → Application → Storage.

**Do not change `try_files` back to `$uri/`.** The direct `$uri/index.html` lookup is strictly better for static SSG output.

**Every `try_files` also needs a `=404` terminator.** Without one, the last
parameter is a *fallback* — an internal redirect back into the same `location`,
which loops until Nginx gives up with a 500 (`rewrite or internal redirection
cycle`) whenever the target page was never built. This has bitten the token
routes twice: `/rider/` (fixed in #23) and both `/newsletter/` blocks. The
correct shape for a token route is:

```nginx
try_files $uri $uri/index.html /rider/index.html =404;
```

The shell page is then an ordinary file check and `=404` ends the chain.

---

### Public rider link 404s until the rider is published

**Symptom:** `GET /api/public/rider/{token}` (and `/rider/{token}` in the SPA) returns 404 for a rider that clearly exists and looks complete in the admin.

**Root cause:** The public link serves a **published version**, never the live rider. A rider is derived from the musicians' saved rigs and changes whenever one of them does — correct while planning, wrong once a venue holds the link. Until someone presses **Publish v1** in the tech rider editor topbar, there is no frozen copy to serve.

**Fix:** Open the rider in `/admin/tech-rider` and press **Publish**. After that the rider's own token always serves whichever version is currently published; each version also has its own permanent token in the version-history modal.

**The link is served by Astro, not the SPA.** `/rider/*` is absent from Caddy's
`@spa` matcher, so `web` answers it — and the page also 404s when the
`tech-rider` module is switched off in `/admin/website-modules`, because a
disabled module unbuilds its routes. Two different causes, one symptom.

**It rendered an empty page for a long time.** `web/src/components/PublicRider.vue`
read `title` and `content_html`; `GET /api/public/rider/{token}` returns a
`{format, taken_at, rider, members, profile, version}` snapshot and has never
sent either field, so every venue link showed a bare "Technical Rider" heading
over nothing. It now renders `<RiderSheet>` from `@bandms/rider-core` — the same
component and resolver the admin previews with. **When adding a field to the
sheet, add it to the snapshot builder too**, and remember the frozen snapshots
of already-published versions predate anything you add.

**Note:** editing a published rider does *not* change what the link serves. That is the point — publish again to push the changes out.

---

### `make fresh` kills Passport clients — must follow with `make passport`

**Symptom:** All API calls that require a Bearer token return 401 after running `make fresh`.

**Root cause:** `make fresh` runs `migrate:fresh --seed` which wipes the `oauth_clients` table. The backend container's entrypoint only creates Passport clients on first startup (when `CLIENT_COUNT = 0`). Reusing the already-running container means the entrypoint never re-runs.

**Fix:** Always run `make passport` immediately after `make fresh`.
`rebuild.sh --fresh-db` handles this automatically — only `make fresh` (direct) does not.

---

### Public site shows stale content after admin changes

**Symptom:** You add/edit a concert, release, or post in the admin, but the public site (`localhost:4322`) still shows the old data.

**Root cause:** The Astro SSG build runs once at container startup (`web/docker/start.sh`). It fetches all API data at that moment and bakes it into static HTML. The container does not watch for changes.

**Fix:** `docker compose restart web` — this re-runs `start.sh`, re-fetches all data, and rebuilds the static site. No image rebuild needed.

---

### `docker compose build web` does NOT rebuild the Astro site

**Symptom:** You run `docker compose build web` expecting the public site to reflect new content or source changes, but nothing changes.

**Root cause:** The Astro SSG build happens inside `start.sh` at container *startup*, not at image build time. `docker compose build` only rebuilds the Node.js image layers. The site is only rebuilt when the container starts.

**Fix:** Always follow a `build` with `docker compose up -d web` (which recreates and starts the container, triggering `start.sh`). Or just use `docker compose restart web` for content-only refreshes.

---

### `docker compose restart web` runs the **image's** source, not yours

**Symptom:** you edit a file under `web/src`, `docker compose restart web`, watch
the Astro build run to completion in the logs — and the site serves the old
behaviour. Nothing errors. Editing again and restarting again changes nothing.

**Root cause:** the `web` service has **no bind mount**; `web/` is copied into the
image at build time. `start.sh` does re-run `astro build` on every start, which is
what makes this convincing — but it builds the *baked* copy. A restart can only
ever rebuild the source the image already holds.

**This is the more dangerous half of the `build`-doesn't-rebuild footgun above.**
That one leaves you with stale *content*; this one leaves you verifying stale
*code* — including reverting a fix, restarting, seeing a test still pass, and
concluding the fix was unnecessary. Both directions of a fail/pass check can be
wrong at once.

**Fix:** rebuild the image, then recreate:

```bash
docker compose build web && docker compose up -d web
```

**Confirm the new code is actually being served** before trusting a result — the
asset hash changes when the source does:

```bash
curl -s http://localhost:4322/en/contact | grep -o 'AvailabilityModal[^"]*' | head -1
# AvailabilityModal.CywzBdN-.js  ← must differ after an edit to that component
```

Content-only refreshes still need nothing more than `restart`.

### Docker goes read-only — `wsl --shutdown`, not Docker Desktop's Restart

**Symptom:** every build dies with `read-only file system` (on
`buildkit/containerdmeta.db`, `overlay2/…`, or a `COPY` step). `docker exec`
returns nothing at all. The stack looks fine in `docker ps` and `/api/health`
still answers 200 — because that is a read path. Anything that writes 500s.

**Confirm it in one command** — the container's own filesystem is the tell:

```bash
docker exec bandms_backend sh -c 'touch /tmp/probe && echo WRITE_OK'
# touch: /tmp/probe: Read-only file system
```

**Root cause is almost always the Windows host disk being full.** The WSL VM's
`ext4.vhdx` cannot grow, writes fail with I/O errors, and ext4 does what ext4
does on an I/O error: it remounts itself read-only to protect the data. Check
`C:` free space first, before anything else.

**Two things that look like fixes and are not:**

- **Docker Desktop → Restart.** It restarts the daemon *inside the same VM*, so
  the read-only mount survives. This is the one that wastes the most time,
  because it is the obvious thing to try and it reports success.
- **Freeing host disk space alone.** Once ext4 has latched read-only it stays
  that way for the life of that VM, however much room appears underneath it.

**The fix is to take the VM down so it remounts clean:**

```bash
wsl --shutdown        # then start Docker Desktop again
```

**A full VM disk does not always present as read-only.** In Sep 2026 builds died
with `failed to copy files: copy file range failed: no space left on device`
while `C:` had **259 GB free** and the write probe above returned `WRITE_OK`. The
VHDX was full, the host was not, and ext4 had never latched read-only — so no
`wsl --shutdown` was needed and pruning alone fixed it. Run the probe before
reaching for the VM restart; the two failures share a cause but not a remedy.

**Then reclaim, because the disk will fill again.** `rebuild.sh` builds
`--no-cache`, so every run adds several GB of buildkit cache *and* leaves the
previous image untagged. A VHDX never shrinks on its own.

**Prune both — dangling images are usually the bigger half.** An earlier version
of this file said the build cache is "where the bloat actually is". That held in
Aug 2026 and was wrong the next time it mattered: in Sep 2026 the cache returned
24 GB and dangling images returned **227 GB**.

```bash
docker builder prune -af         # build cache — safe
docker image prune -f            # untagged images only — safe
```

**Keep `image prune` at `-f`, never `-a`.** Without `-a` it removes only
*dangling* (untagged) images, so everything a compose file references survives.
`-a` removes every image not currently used by a *running* container, which takes
out the rest of the stack the moment anything is stopped.

**`docker builder prune` returns `0B` while a build is running** — the in-flight
build holds the cache mount. That reads as "nothing to reclaim" and is the wrong
conclusion. Re-run it once the build finishes.

**`docker system df` can fail outright in this state**
(`error getting build cache usage: … too many levels of symbolic links`), so the
obvious "what is using space?" command is unavailable exactly when it is needed.
Prune first, measure after.

**Do not reach for `docker system prune -a --volumes`.** After a WSL shutdown the
containers are stopped, so *every* volume counts as unused — including
`bandms_mysql_data` (the dev database, with published riders and EPK versions
that no seeder restores) and the unrelated `workflow-manager_*` and
`backend_sail-pgsql` volumes from other projects on this machine.

**Pruning frees space inside the VHDX, not on `C:`.** The file stays fully
allocated — 236 GB here while nearly empty inside. Returning it to Windows needs
a compact, with WSL shut down:

```powershell
wsl --shutdown
Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx" -Mode Full
```

**Neither compaction route works on this machine** — checked, and worth not
rediscovering:

| Route | Why it fails here |
|---|---|
| `Optimize-VHD` | needs the Hyper-V PowerShell module, which is not installed |
| `wsl --manage … --set-sparse true` | needs WSL 2.0+; `wsl --version` is rejected outright |
| `diskpart` → `compact vdisk` | works without Hyper-V, but needs an **elevated** shell |

So on this box the only way to give space back to Windows is to move the file to
a drive that has room — see below.

---

### Moving Docker's disk to another drive

Done once, in Aug 2026: `C:` had hit 0 GB free, which is what drove the
read-only failure above. The 236.7 GB VHDX now lives on `F:`, and `C:` went from
23.9 GB to 260.6 GB free.

**The registry `BasePath` is the only thing that controls placement.** Every
guide tells you to edit `dataFolder` in `%APPDATA%\Docker\settings.json`. That
key is a **Hyper-V-backend leftover and is inert on a WSL2 backend** — it reads
`C:\ProgramData\DockerDesktop\vm-data` here, which is not even where the disk
is. Editing it appears to work and moves nothing. The real key, under `HKCU`
(so no elevation needed):

```
HKCU\Software\Microsoft\Windows\CurrentVersion\Lxss\{guid}\BasePath
```

Pick the child key whose `DistributionName` is `docker-desktop-data` — that is
the volumes and images. `docker-desktop` is the tiny runtime distro; leave it.

**The value must keep its `\\?\` prefix**, matching the sibling entry's shape.
Getting this wrong is the worst failure available here: WSL cannot resolve the
path, and Docker's response is to initialise a **fresh empty** distro — which
looks like a clean start while silently orphaning `bandms_mysql_data` and every
other project's volumes. Verify by character codes rather than by re-typing the
string; a bash heredoc silently collapsed `\\?\` to `\?\` when this was first
attempted, and the check that "confirmed" it compared against the same corrupted
literal, so it passed.

**Sequence** — the order matters, and nothing is deleted until the end:

1. Quit Docker Desktop, kill `com.docker.*`, then `wsl --shutdown`
2. Confirm the VHDX is unlocked before copying (open it `ReadWrite`/`None`)
3. Copy with `robocopy <src> <dst> ext4.vhdx /J` — **without `/MOVE`**, so the
   source survives until the copy is proven
4. Verify (below), *then* set `BasePath`, *then* start Docker
5. Confirm volumes and data, and only then delete the source

**Run the copy detached, not as a session-owned background task.** The first
attempt used the agent's background shell; the session ended, the task was torn
down, and robocopy died about a quarter of the way in — leaving a file that
looked complete. `Start-Process robocopy … -WindowStyle Hidden` survives.
Expect ~10 min at ~445 MB/s for 236 GB.

**Size and mtime cannot tell you whether the copy finished.** `/J` (unbuffered
I/O) **pre-allocates the destination**, so it reaches its full final size in
seconds and Explorer shows two identical files. The killed first attempt carried a
*newer* mtime than the source, which reads as "finished later". Both signals are
structurally incapable of reporting progress.

- **Progress while it runs:** the destination is exclusively locked, so it
  cannot be read. Use the copier's own counter —
  `(Get-CimInstance Win32_Process -Filter "ProcessId=<pid>").WriteTransferCount`.
- **Integrity when it ends:** compare MD5 of blocks read at *identical offsets*
  in both files (96 × 8 MB spanning the file is enough, and takes seconds). A
  truncated copy shows up as a repeating all-zero hash past the frontier.
  Robocopy's `Bytes: … copied / FAILED 0` summary is the tool grading its own
  work, and it is written only if the run finishes — the killed attempt left an
  **empty log**, so there was no failure to notice, just a full-size file and
  silence. Absence of a summary is easy to miss; the block comparison is what
  actually settles it.

**Confirm which disk is actually in use** before trusting anything: after Docker
starts, the *new* VHDX must be **locked** by WSL and the old one **unlocked**.
That single check distinguishes "running from F:" from "running from a fresh
empty distro".

Then verify the data, not just that containers came up — `docker volume ls`
against a known baseline, plus real row counts (`concerts`,
`tech_rider_versions`, `website_modules`). ext4 will happily mount an image
whose later blocks are zeros; the damage only surfaces when InnoDB reads a page
that is not there, so counts force those reads.

---

### `web` container hangs silently if backend never becomes healthy

**Symptom:** `bandms_web` stays in a running state but the public site never loads; `docker logs bandms_web` shows the health-check loop still printing.

**Root cause:** `start.sh` polls `/api/health` in an infinite loop with no timeout. If the backend is stuck (bad env var, failed migration, DB issue), the web container waits forever.

**Fix:** Check the backend first: `docker logs bandms_backend`. Fix whatever is blocking it — the web container will unblock automatically once `/api/health` responds.

---

### `web` container crash-loops when the Astro build fails — and takes the whole public site down

**Symptom:** The public site is down. `docker ps` shows `bandms_web` as *running* with a low uptime that keeps resetting. `docker inspect bandms_web --format '{{.RestartCount}}'` is in the dozens or hundreds.

**Root cause:** `start.sh` runs `astro build` at container startup. A build failure exits the container, `restart: unless-stopped` starts it again, and it fails again — roughly every 25 seconds, indefinitely. Nothing surfaces the error: the container looks healthy in `docker ps`, and `docker logs` may hang while it is mid-restart. This ran for **two months** undetected (RestartCount 103) after a single bad row appeared.

**The build is all-or-nothing.** One page that throws aborts all 35 — a single unreachable record takes down the entire site, not just its own page.

**Diagnose:**

```bash
docker inspect bandms_web --format 'RestartCount={{.RestartCount}}'
timeout 20 docker logs bandms_web 2>&1 | grep -A5 ERROR
docker compose stop web        # stop the churn before investigating
```

Reproduce the build directly against a live API — far faster than rebuilding the image each time:

```bash
cd web && API_BASE=http://localhost:8081 pnpm build
```

**Two failure modes seen so far, both invisible to `vue-tsc`:**

1. **`getStaticPaths` returning the wrong param name.** `concerts/[slug].astro` was renamed from `[id].astro` but still returned `params: { id }`, leaving `params.slug` undefined; Astro's `getParameter` throws and the build dies. Note `null` does *not* throw — it silently builds a page at `/concerts/null` — so only `undefined` crashes.
2. **Dereferencing a field the API does not send.** `epk.testimonials.length` where `EpkSnapshotBuilder` never emits `testimonials`.

**Both slipped through because the types lie.** `slug_en` is typed `string` while the column is nullable, and `testimonials` was a required array the API never returns. When adding a field to `web/src/types/`, make it match what the API *actually* returns — and guard anything read from a published EPK version, whose frozen snapshots predate any field added later.

### Verifying the public build when the API (or Docker) is down — stub it

`web/src/lib/cms.ts` funnels every request through one `get()` helper hitting
`${API_BASE}/api/…`, so a ~40-line Node server on a spare port builds the whole
site with the stack down:

```bash
cd web && API_BASE=http://localhost:8098 pnpm build
```

**Give the stub different slugs per locale** (`contact`/`kontakt`,
`about`/`o-nas`). Identical slugs make a wrong per-locale URL look correct — that
is exactly how the hreflang bug below survived. Then assert against `dist/`,
never by reading the source.

Two stub gotchas: return `{"data": {...}}`, because `get()` unwraps `data`; and
give `/band-profile/epk` a *full* object — `[]` reproduces the documented
"dereferencing a field the API does not send" crash and takes the build down.

### Type-checking `web/`

`pnpm build` is the token lint plus `astro build`, which is transpile-only — it
will not catch a type error. **Do not run `astro check` in an agent shell:** it
prompts to install `@astrojs/check` and hangs. Use:

```bash
cd web && npx tsc --noEmit -p tsconfig.json
```

It reports **two pre-existing errors** — `themes/skanking-storks/slots.ts` cannot
resolve `.astro` imports, and `types/shop.ts` has a `ShopItem`/`ShopItemSummary`
variance mismatch. Filter those two; anything else is yours. Note `tsc` does not
check `.astro` files at all, so wiring bugs inside them surface only in `dist/`.

---

### A disabled module unbuilds its pages — every link to it must be gated

**Symptom:** A public page 404s from a link on another public page. Nothing fails
at build time: `astro build` is green, `vue-tsc` is green, and the linking page
renders perfectly.

**Root cause:** `[lang]/[section].astro` and `[lang]/[section]/[slug].astro` both
skip a module whose `modules.<slug>` is `false`, so switching a module off in
`/admin/website-modules` **deletes its routes**. Any page that links to those
routes without consulting the same map now points at nothing.
`web/src/pages/[lang]/index.astro` did exactly that: its hero CTAs were ungated,
and its Upcoming shows / Music / News sections were gated on `data.length > 0` —
a *content* check standing in for a *routing* check. The two agree right up until
content exists while its module is off, which is why it survived so long.

**Fix:** gate on the module map, not on the data.

```astro
const enabled = (slug: string) => siteConfig.modules[slug] !== false
```

Use `!== false`, never `=== true`. `getSiteConfig` fails open to `{}` when the API
is unreachable mid-build (`web/src/lib/cms.ts`), so an absent key has to mean
*enabled* — otherwise one build-time blip ships a homepage with no content at all.

**Verify against the built output, not by reading the page.** Resolve every href
in `dist/` and check both directions — an inverted gate looks entirely plausible
when you only test with the module switched off:

```bash
for h in $(grep -o 'href="/en/[a-z0-9/-]*"' dist/en/index.html | sed 's/href="//;s/"//' | sort -u); do
  p="dist${h%/}/index.html"; [ -f "$p" ] && echo "OK   $h" || echo "DEAD $h"
done
```

---

### Module URL slugs are stored per locale — never derive them from the label

**Which locales exist at all is the registry's job** — see *Adding a language*
below. This section is about how a slug is *stored and resolved* within them.

**The rule:** `website_modules.custom_slug` holds `{"en": "shop", "pl": "sklep"}`.
`GET /api/site-config?lang=xx` serves it as `module_config.<key>.slug` with the
fallback **already resolved**, so `web/src/lib/slugs.ts` just reads it. There is
no `slugify()` in the public site any more — do not reintroduce one.

**Empty slug means the module key**, not the label. `videos` with no stored slug
serves `/en/videos` however it is labelled.

**Which field moves a page:**

| Change | Effect on the URL |
|---|---|
| Custom name (label) | none — nav text only |
| Custom slug | **moves the page**; old links 404 |

This split is the entire point of the field. Slugs used to be `slugify(label)`,
so renaming "Shop" to "Merch store" silently moved `/en/shop` and broke every
inbound link.

**Uniqueness is checked against *effective* slugs** — stored value **or** module
key. Claiming `"epk"` is rejected even though the EPK module stores no slug of
its own, because it is served there by fallback. A plain
`WHERE custom_slug = ?` check would miss that and shadow a live page.

**A partial update must not clear the other locale.** `{"en": "shop"}` leaves the
PL slug alone; only an explicit `{"en": null}` clears one. `custom_name`
overwrites both, which is fine for a label and wrong for a URL.

---

### A social link has exactly one owner — and the owner columns are a whitelist

`social_links` carries four owner FKs: `profile_id` (the band's own links),
`member_id`, `author_id`, `venue_id`. **Exactly one is set.** All four are
nullable; `profile_id` was `NOT NULL` until Sep 2026, which is what broke authors
and venues.

**The bug this caused, because the shape recurs.** `author_id`/`venue_id` were
added in `2026_06_28_000001` without relaxing `profile_id`, so every author- and
venue-owned insert died with `ERROR 1364: Field 'profile_id' doesn't have a
default value` — *after* `AuthorController::store()` had already committed the
author. The save both failed and succeeded: a 500 toast over a saved record, and
links that never persisted. No author or venue link had ever saved.

**Do not fix a missing owner by backfilling `profile_id`.** It satisfies the
constraint and silently publishes the row. `BandProfile::socialLinks()` filtered
on `whereNull('member_id')` — excluding member links *by name* rather than "links
owned by someone else" — so an author link, whose `member_id` is null, would have
surfaced in the band's public links, the EPK snapshot and `BandProfileResource`.
The insert error was loud; that leak would not have been. The relation now
excludes all three foreign owners, and **adding a fifth owner column means adding
it there too.**

**Ordering is explicit, not incidental.** Every write site sets `position` from
the payload index, and all four relations `orderBy('position')`. This used to
work by accident: `syncRelations()` deletes every link and recreates them in
array order, so auto-increment `id` happened to match. Anything that stops
recreating from scratch — a partial update, an upsert — silently scrambles the
editor's drag order. `AuthorTest` pins this by inverting `position` against `id`
and asserting the read follows `position`.

**Writes that touch a parent plus its links belong in a transaction.**
`AuthorController` wraps `store`/`update` in `DB::transaction`, so a failure in
the link loop cannot leave a half-saved parent behind.

### `setTranslations()` merges — clearing one locale needs `forgetTranslation()`

**Symptom:** you clear a translated field for one locale, get a 200 back, and the
old value is still there.

**Root cause:** Spatie's `setTranslations($key, $array)` **merges** the array into
the existing translations rather than replacing them, so omitting a locale (or
filtering it out) leaves its old value untouched. An *empty* array takes a
different branch and does clear everything — which is why a "clears both" test
can pass while "clears one" fails.

**Fix:** decide per locale and forget explicitly.

```php
filled($value)
    ? $module->setTranslation($key, $locale, $value)
    : $module->forgetTranslation($key, $locale);
```

Applies to every `$translatable` field, not just module slugs.

---

### Backend env var changes require a container restart

**Symptom:** You update an env var in `docker-compose.yml` (e.g. `APP_URL`, `LOG_LEVEL`) but the backend behaves as if the old value is still set.

**Root cause:** `entrypoint.sh` runs `php artisan optimize` at startup, baking env values into the config cache. The cache survives for the lifetime of the container — editing `docker-compose.yml` without recreating the container has no effect.

**Fix:** `docker compose up -d backend` (recreates and restarts the container, re-running the entrypoint with the new env). Or manually: `docker exec bandms_backend php artisan optimize:clear && php artisan optimize`.

---

### `pnpm dev` in `app/` proxies API to port 8081 — which is now Caddy

**Symptom:** Running `pnpm dev` in `app/`, API calls (`/api/*`) return network
errors or hit the wrong host.

**Root cause:** `app/vite.config.ts` targets `http://localhost:8081`. That used
to be the `frontend` container and is now **Caddy**, which proxies `/api/*` and
`/storage/*` to the backend itself — so the default still works, and works for
one more reason than before. It breaks only if nothing is listening on 8081,
i.e. the stack is down or `SITE_PORT` was changed.

**Fix:** keep `SITE_PORT=8081` in the root `.env` and `docker compose up -d caddy`.
Override the target explicitly when you need a different one:
`API_PROXY_TARGET=http://localhost:8082 pnpm dev`.

**Do not set `FRONTEND_PORT=8081`.** Caddy owns that port now; the SPA container
publishes **8082**, and pointing both at 8081 fails the bind on `up`.

### Astro public site may build with incomplete data on first startup

**Symptom:** Some public pages load but show missing/empty data (e.g. no concerts listed) immediately after a fresh stack start, even though the API is healthy.

**Root cause:** `web/docker/start.sh` waits for `GET /api/health` to return 200 before building. Laravel's `/api/health` can return 200 while migrations or seeders are still running in the background. The Astro build then fetches data mid-migration and bakes the incomplete snapshot into the static HTML.

**Fix:** If the public site looks empty right after first boot, wait 30–60 seconds for migrations/seeders to fully settle, then `docker compose restart web` to trigger a fresh build with complete data.

---

### Setting a backend env var in `.env` alone does nothing — it must be in `docker-compose.yml` too

**Symptom:** You set a variable in the root `.env`, restart, and the backend behaves as if it were never set. Newsletter confirmation emails contain `http://localhost/newsletter/confirm/...` despite `FRONTEND_URL=http://localhost:4322`; CORS rejects the origin you configured.

**Root cause:** The `backend` service declares an explicit `environment:` map and takes **no `env_file`**. Root-`.env` values reach the container only where the compose file interpolates them (`APP_KEY: ${APP_KEY}`). Anything not listed there is simply absent, and Laravel silently falls back to the config default. `FRONTEND_URL` was missing for a long time, so `config/cors.php` was using its `http://localhost:5173` fallback and `config/newsletter.php` was falling back to `APP_URL`.

**Verify before believing it works:**

```bash
docker exec bandms_backend printenv FRONTEND_URL LOGIN_RATE_LIMIT
```

Empty output means the variable never arrived, regardless of what `.env` says.

**Fix:** Add the variable to the `backend` service's `environment:` block in **both** `docker-compose.yml` and `docker-compose.prod.yml`, then `docker compose up -d --no-deps backend` to recreate (a restart is not enough — see the env-cache footgun above).

`FRONTEND_URL` drives CORS allowed origins and every link in outgoing email, so it must match the port users actually browse on: `http://localhost:4322` in development, the real domain in production.

---

### Public `/admin` is a blank page — the Caddy `@spa` matcher must list assets, not just routes

**Symptom:** `/admin` on the server returns **200 with correct HTML**, but renders
blank white. The console shows only:

```
GET /assets/index-<hash>.js  404 (Not Found)
GET /assets/index-<hash>.css 404 (Not Found)
```

**Root cause:** `docker/caddy/Caddyfile` routes by an explicit path list — `@spa`
goes to the `frontend` container, everything else falls through to Astro. But the
SPA's *build output* also lives at the root: Vite builds `app/` with `base: '/'`
and the default `assetsDir`, so the served `index.html` asks for
`/assets/index-<hash>.js`. With `/assets/*` missing from `@spa`, those requests
fell through to the `web` container, which emits its own assets under `/_astro/`
and has no `/assets/` at all. No JS runs, and a Vue SPA with no JS renders an
empty `<div id="app">`. The HTML returning 200 is what makes this look mysterious.

**Fix (already applied in #47):** `/assets/*` and `/vite.svg` are in the matcher.

**The matcher holds two different kinds of thing.** Page routes, which track
`app/src/router/index.ts`, *and* the SPA's static output. **Adding a file to
`app/public/` means adding it to the matcher too**, or it 404s in production while
working fine in dev — `pnpm dev` and the dev `frontend` container both serve the
whole SPA from one origin, so no local setup can reproduce this.

**Diagnose from outside** — the question is always *which container answered*:

```bash
curl -o /dev/null -w '%{http_code}\n' http://SERVER/robots.txt  # 200 = web (Astro) is the fallthrough
curl -o /dev/null -w '%{http_code}\n' http://SERVER/vite.svg    # 404 = SPA static is NOT routed
```

**Beware a false green when probing asset paths.** The SPA's nginx ends in
`try_files $uri $uri/ /index.html`, and its long-cache block only matches real
extensions — so a *mistyped* asset name (`App-abc123js`, dot lost) misses the
asset block, hits the SPA fallback, and returns **200 with `index.html`**. Always
check `content_type`, and confirm a genuinely absent file 404s before trusting a
row of 200s.

---

### A changed `Caddyfile` does nothing until the container is **recreated**

**Symptom:** You edit `docker/caddy/Caddyfile`, deploy or run
`docker compose up -d caddy`, and routing behaves exactly as before. The new file
is definitely on the server — `cat` proves it.

**Root cause:** The Caddyfile is a bind mount. Compose decides whether to recreate
a container by hashing the **service definition** — image, env, volume
*declarations* — and a mounted file's *contents* are not part of that hash. The
container is reported up-to-date and skipped, and Caddy parses its config once at
startup. `scp` also replaces the file's inode, which a single-file bind mount does
not follow.

**The tell is in `docker ps`:** after a deploy, `bandms-caddy` shows an uptime far
older than everything around it — `Up 22 hours` sitting next to `Up 2 minutes`.
That is how #47 was spotted.

**Fix (already applied to `.github/workflows/deploy.yml` in #47):**
`--force-recreate`, the same treatment `web` already gets. A manual edit on the
server needs it too — a plain restart is not enough:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate caddy
```

**Validate before recreating.** A malformed Caddyfile takes down the *whole* site,
not just the route being changed:

```bash
docker run --rm -e SITE_ADDRESS=":80" \
  -v /opt/bandms/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

**A manual server-side edit is a hotfix, not a fix.** The deploy `scp`s
`docker/caddy/Caddyfile` from `main` over whatever is there, so an unmerged change
is silently reverted on the next push — and with Caddy now force-recreated, it
takes effect immediately. Land the same edit in the repo.

---

## The public site is themeable — never hardcode a colour, font or radius

`web/src/` is split into a **base** (structure + a plain black-and-white look)
and **themes** that override it. Skanking Storks' 2-Tone design is one theme;
the base is what a new band gets before theming.

**The contract:** components may reference only the semantic tokens in
`web/src/styles/tokens.css` — `text-muted`, `bg-surface`, `border-border`,
`rounded-card`, `shadow-card`, `var(--font-display)`, `var(--page-gutter)`.
A raw value (`text-zinc-400`, `#121212`, `rounded-xl`, `'Anton'`,
`rgba(239,231,214,.7)`) is invisible in review, passes `astro build`, and
silently makes that element untheme-able.

`pnpm build` runs `scripts/check-tokens.mjs`, which fails on all of the above.
For a genuinely fixed value, append `token-lint-ignore` on that line.

Primitives (`--ss-ink`, `--ss-teal`) belong **only** in
`web/src/styles/themes/*.css`. Nothing else may reference them.

**Which theme renders** is `PUBLIC_THEME`, set in the `web` service of both
compose files and threaded through `web/docker/start.sh`. It becomes
`<html data-theme="…">`. Unset means the base theme — that is why a build with
no env shows a plain black-and-white site rather than a broken one.

**Ornament that tokens cannot express** (checker strips, grain, the hero
backdrop) goes through `<ThemeSlot name="…" />`. The base renders nothing; a
theme registers a component in `web/src/themes/<name>/slots.ts`.

**Slots take props, never children.** A slot accepting children is a component
override in disguise, and overrides are deliberately not supported: each one is
a fork that stops receiving base improvements. If a design needs something no
slot can express, add the element to the *base layout* — unstyled, where every
band gets it — rather than widening the slot contract.

### An *undefined* token is worse than a raw one

A raw value is loud: `text-zinc-400` is obviously wrong. An undefined token is
silent — `hover:bg-accent-dark` when no such token exists reads as correct,
Tailwind emits nothing for it, and the style simply never applies. Seven dead
hover states and one dead background (`bg-surface-3`) shipped that way, both
introduced by the token migration dropping `--color-accent-dark` and
`--color-surface-3` without converting the call sites.

`scripts/check-tokens.mjs` now fails on any utility whose suffix begins with one
of *our* namespaces but is not declared in `tokens.css`. Tailwind's own keywords
(`bg-transparent`, `text-sm`, `border-none`) are never judged, because only our
namespaces are checked.

**So: removing a token is a breaking change.** Grep for its utility before
deleting it from the contract.

### `text-white` cannot be find-and-replaced

There were 93 of them and they all sat on dark ground, because the site used to
be dark. Under a cream theme most sit on light. The blanket conversion made them
`text-body`; genuinely inverse surfaces (lightboxes, media scrims, the ink nav,
ink contact cards) were given `text-on-inverse` by hand. When adding markup, ask
which ground the element sits on — the answer is no longer "always dark".

---

## Adding a language — the locale registry

**Three files declare the locales, and nothing else may.** An `'en'` or `'pl'`
literal anywhere outside them is a bug waiting for the third language.

| File | Owns |
|---|---|
| `api/config/locales.php` | server registry + fallback chains |
| `web/src/lib/locales.ts` | public-site mirror; `Locale` is **derived** from it |
| `app/src/locales.ts` | admin mirror (tab labels, empty draft bags) |

`web/astro.config.mjs` **imports** `LOCALES`/`DEFAULT_LOCALE` from the mirror
rather than repeating them — Astro's own `i18n.locales` is otherwise a fourth
list, and a route emitted for a locale Astro does not know leaves
`Astro.currentLocale` undefined on that page.

Server-side code reads the registry through `App\Support\Locales` (`codes`,
`default`, `chain`, `resolve`, `unsupportedKeys`, `all`) — never
`config('locales.*')` directly. `GET /api/site-config` serves the list as
`locales`, plus the resolved `locale` of the response itself; `web` mirrors
rather than consumes it because `Locale` is a compile-time union that decides
which routes `getStaticPaths` emits, and `cms.ts` warns (never throws) on drift.

**Adding `de` is one entry per file, plus `STATIC_SLUGS`.** That last one is
deliberate: `web/src/lib/slugs.ts` types `SlugMap` as `Record<Locale, …>`, so a
new locale is a *compile error* at the one place needing a human-chosen value.
To confirm the registry is still load-bearing, add a throwaway locale and run
`cd web && npx tsc --noEmit -p tsconfig.json` — it should report **exactly one**
new error, at `STATIC_SLUGS`. More than one means something drifted back to a
hardcoded pair. (Two unrelated errors are pre-existing; see *Type-checking
`web/`*.)

Two things are deliberately still per-locale columns and **not** registry-driven:
`slug_en`/`slug_pl` on concerts/releases/posts/albums/shop_items (a third locale
needs a migration — this is why `PostController` and `ReleaseController` still
name `'pl'`), and the ~23 inline `T = { en: …, pl: … }` UI-string dicts.

### The fallback policy is *declared*, never scanned

Each locale gets an ordered `fallbacks` list; resolution walks
`[locale, ...fallbacks]` and stops at the first non-empty value. There is
deliberately **no "then try every other locale" tail** — invisible with two
locales, but at three it starts showing a German visitor Polish text. The old
`foreach ([$locale, 'en', 'pl'] …)` in `FaqSummaryResource` and
`WebsiteModuleController` was exactly that tail.

`en` and `pl` fall back to each other, which is a choice for *this pair* — a
half-translated FAQ should show the language it has rather than render an empty
accordion row in a green build — and is **not** a template. A third locale
should normally declare `['en']` alone.

`Locales::resolve()` returns `null`, not `''`, so the caller coerces and the
choice stays visible where a static build would bake it.

### Never derive one locale's URL from another

Routes build `alternates: Partial<Record<Locale, string>>` — a path per locale —
and hand it to the layout, which passes it to `BaseHead` and `LanguageSelector`.
Only the route knows the other locale's section slug (`/en/contact` vs
`/pl/kontakt`), so only the route can build it.

`BaseHead` used to compute `hreflang="pl"` as `${site}/pl${Astro.url.pathname}`,
describing a "/en is unprefixed" scheme the site had already stopped using: `/en/`
advertised `/pl/en/`, and `/pl/` claimed to *be* the English page. Wrong on every
page, well-formed markup, green build. `LanguageSelector` had the twin bug — a
hardcoded EN/PL pair with both options pointing at one href.

**A locale with no path is skipped, not guessed** — a wrong alternate is worse
for a crawler than a missing one, which is why the legacy unlocalised `/epk`
emits only `en` + `x-default`. And `x-default` points at the **default locale**,
not the current page.

**Every href is normalised to Astro's directory form** (trailing slash).
`build.format` defaults to `'directory'`, so `Astro.url.href` — which `BaseHead`
uses as the canonical — always ends in `/`. A self-referential alternate that
differs from the canonical by one slash is a broken hreflang cluster, and it is
invisible unless you diff `canonical` against `hreflang` in `dist/` on the same
page. `hreflangLinks()` owns that normalisation so the two cannot drift.

**A hardcoded path in an `alternates` map is now a wrong hreflang**, not merely a
wrong footer link — the legacy `/releases/{id}` route resolves its Polish twin
through `getSlugMap()` for exactly this reason.

The alternates prop threads through 15 section/detail components that never read
it. That pass-through is why the bug survived: the plumbing looked load-bearing,
so nobody questioned that the *value* was structurally incapable of being right.

---

## FAQ entries are per subpage

`faqs.module_slug` mirrors `website_modules.slug`, so FAQ categories track the
site's sections instead of being a second taxonomy. `<FaqSection module="…" />`
is already in all nine section components and renders nothing when that page has
no published questions.

That is a *content* check, and deliberately so: the "gate on the module map, not
on the data" rule above is about links that can 404, and this section links
nowhere. An empty accordion is worse than an absent one.

`module_slug` is validated against live `website_modules` rows, so adding a
module makes it an FAQ category with no code change. Disabled modules are still
valid targets — switching a section off must not make its questions unsavable.

---

## Editable page copy lives in `website_modules.settings`

A generic bag shaped `{"field": {"en": "...", "pl": "..."}}`, not named columns —
six Contact fields as columns would put one module's fields on every module's
row. `GET /api/site-config?lang=xx` serves it as `module_config.<key>.settings`
with the locale already resolved, falling back to the other locale rather than
emitting null.

Read it as `siteConfig.module_config?.<key>?.settings ?? {}` and then
`settings.field ?? ''`. An API predating the migration omits the bag entirely,
and a bare access throws at build time — which kills all 35 pages, not one.

**Which fields a module has is a client-side decision.** The server validates
the shape (`{field: {en, pl}}`) and the 2000-char limit, nothing more. The admin
form is generated from `app/src/config/moduleSettings.ts`, so adding a field is:
add it there, then read it in the Astro section. No migration.

A module absent from that map simply shows no copy fields, which is why adding
one is additive and safe.

**A module need not be a page.** `footer` is a `website_modules` row with no
route and no meaningful slug — it exists so its copy is editable and so it can be
switched off. `app/src/config/moduleSettings.ts` lists such modules in
`NON_PAGE_MODULES`, and the admin hides the URL-slug and per-page inputs for
them rather than offering controls that change nothing. Neither `Header.astro`'s
`MODULE_SLUGS` nor `[lang]/[section].astro`'s section lists include it, so no nav
entry or route can appear by accident.

Editors live at **`/admin/website-modules`** (page copy, per module) and
**`/admin/faqs`** (questions, grouped by subpage).

---

## Astro islands cannot share props — use a nanostore

Two islands on the same page are two separate Vue apps. The availability
calendar and the contact form talk through `web/src/stores/booking.ts`, the same
way the cart icon and drawer share `cartItems`. That pattern is proven in this
build; do not assume an Astro `<script>` tag can import the same store instance.

**Island props are serialised to JSON**, so a function prop throws at build time.
`ContactForm` takes `bookingSubject` as a `'… {date}'` template string and does
the interpolation itself for exactly this reason.

**A modal island needs `client:idle`, not `client:visible`.** It renders nothing
until opened, so a visibility trigger never fires and its document-level click
listener never attaches. Triggers elsewhere on the page carry
`data-open-availability` and are picked up by delegation from `document`, which
avoids passing a handler across the island boundary.

---

## Disabling a module used to leave its page served

**Symptom:** switch a module off in `/admin/website-modules`, restart `web`, and
its page still loads — with stale content. `astro build` correctly omits the
route (`[lang]/[section].astro` filters on `cfg.modules[section] !== false`), and
the API correctly reports the module as disabled.

**Root cause:** `web/docker/start.sh` published the build with
`cp -r /app/dist/* /usr/share/nginx/html/`, which **merges**. A page absent from
the new build kept the copy from the previous one. `docker compose restart`
reuses the container filesystem, so the directory accumulated across every run;
only `up -d --force-recreate` ever started clean. That silently inverted the
guarantee the module system rests on.

**Fix (applied):** `rm -rf /usr/share/nginx/html/*` before the copy.

**Why it hid for so long:** the two commands disagreed. Anyone who happened to
force-recreate saw correct behaviour, and anyone who restarted saw a page that
"should not exist" and assumed a caching quirk. If you are ever unsure whether
you are looking at a fresh build, compare a page against the database rather
than against the build log — a card for a record you just deleted is the tell.

---

## `Teleport` in an Astro island must be gated on mount

**Symptom:** two modals on one page, and the second one never opens. Its trigger
is in the DOM, its click handler is written correctly, and nothing looks wrong.
The console holds the answer:

```
Hydration completed but contains mismatches.
TypeError: Cannot read properties of null (reading 'insertBefore')
```

**Root cause:** Astro server-renders Vue islands. A `<Teleport>` rendered on the
server leaves behind a hydration anchor that is not in the emitted HTML, so Vue
throws while patching it. With a single modal the failure is survivable — the
dialog still works. With two, the second teleport's anchor resolves to `null`,
that component never finishes mounting, and the `document` click listener it
attaches in `onMounted` is never registered. The dialog is simply inert.

**Fix (in `web/src/components/ModalShell.vue`):** render nothing until mounted,
so the teleport is client-only.

```vue
const mounted = ref(false)
onMounted(() => { mounted.value = true })

<Teleport v-if="mounted" to="body">
```

**Why it is worth knowing:** the first symptom is a *silent* failure in an
unrelated component, and neither `astro build` nor the token lint nor `vue-tsc`
says a word. Only a browser console does — which is why the public-site specs
capture `pageerror`.

---

## E2E specs that write to the dev database must restore it

`website-modules.spec.ts` edits real page copy, and the public site bakes
whatever is in the database when its container starts — so a run that does not
clean up leaves `E2E KICKER 17878…` on the live contact page until someone
notices. That spec now captures the original value in `beforeAll` and writes it
back in `afterAll`.

Anything else that mutates shared dev content needs the same treatment. Note
that restoring the row is not enough on its own: the public container still
holds the stale build, and a **`docker compose restart web`** is what re-fetches
and rebuilds. `docker compose up -d web` will report "Running" and change
nothing.

---

## Availability is cached for 5 minutes

`GET /api/band-profile/calendar/availability-range` caches per month-range, so a
concert added in the admin can take up to five minutes to show as `booked` on
the public calendar. That is deliberate — every uncached day means re-parsing
each member's remote iCal feed — but it makes "I added a gig and the calendar
still says open" a non-bug. `php artisan cache:clear` forces it.

It also makes the endpoint look broken when testing: querying a range, changing
data, then querying the same range returns the first answer.

---

## E2E fixture names need more than a timestamp

`SeedE2eTicket` built its fixture names from `now()->format('YmdHis')` against
`venues.name_unique`. Playwright runs specs in parallel, so two seeds in the same
second collided — and it surfaced as `fan-accounts.spec.ts` failing with a
duplicate-key stack, which reproduces in the full suite but passes in isolation.
That combination looks exactly like the machine-flake pattern below and is not.
The stamp now carries a random suffix.

**Triage note:** "passes in isolation, fails in the suite, *same spec every
time*" is a real ordering or contention bug. The machine-flake signature is a
*different* set of specs each run.

---

## The SPA is the admin panel — public pages live in `web/`

`app/` once carried the public site too. It no longer does: Caddy routes only
`/{$ADMIN_PATH:admin}*`, `/account*`, `/tickets/*`, `/tech-rider*`, `/assets/*`
and `/vite.svg` to the SPA, and everything else falls through to Astro. 27 public
views (home, about, concerts, releases, posts, photos, merch, cart, checkout,
press, EPK, newsletter, the public rider…) were deleted along with their routes
and the redirect aliases that fed them; the surviving non-admin views are
`FanAccountView`, `TicketClaimView` and `TechRiderPreviewView`.

`/login` is absent from that list because the route no longer exists — see *The
front door* above. The admin prefix is a variable, so a hardcoded `/admin*` in
the matcher would silently strand a relocated panel.

**So a public page is built in `web/`, never in `app/src/views/`.** A route added
to the SPA that is not in the `@spa` matcher is unreachable in production while
working perfectly under `pnpm dev` — the dev server serves the whole SPA from one
origin and applies no allowlist. That divergence is why the broken public rider
survived: its E2E spec exercised the SPA's working copy while production served
Astro's stub.

**The `@spa` matcher and `app/src/router/index.ts` must be edited together.**

## Rider rendering is shared — `@bandms/rider-core`

The sheet a venue prints and the sheet the band previews are one component,
`RiderSheet.vue`, fed by one resolver. They were nearly duplicated instead, and
the failure mode that argued against it is specific: if two copies of the
resolver disagreed on channel numbering, the band would rehearse against one
patch list while the venue patched from another.

The package ships **TypeScript and SFC source, not a build** — both consumers
run Vite. That has two consequences worth knowing:

- `web/astro.config.mjs` sets `vite.ssr.noExternal: ['@bandms/rider-core']`.
  Without it Astro externalises the dependency and Node is handed a `.vue` file
  it cannot parse, failing the SSR pass with an error that names `astro build`
  rather than the component.
- The sheet is styled with **fixed values, deliberately**. It is a document a
  venue prints and must come out black-on-white whatever theme the site wears,
  so it lives in the package rather than in `web/src`, where the token lint
  (correctly) rejects raw colours. `scripts/check-tokens.mjs` walks `web/src`
  only — the lint boundary and the architecture boundary are the same line.

Its specs run under the admin's vitest (`app/vitest.config.ts` includes
`../packages/*/src/**/*.spec.ts`), so there is still one command and one bitmask
bit in `scripts/test-all.sh`.

## Quality standard — tests run by default

**Always run the full test suite before reporting a feature done or before shipping.**
Quality over speed: a feature that breaks existing tests is not done, even if it works visually.

```bash
make test        # backend unit tests (Pest, ~15 s) — run after every backend change
make test-all    # unit + E2E Playwright — run before shipping
```

**Three unit suites, not two.** `app/` covers the admin SPA and `web/` covers the
public site's `src/lib` — `cms.ts` and `slugs.ts`, which decide what gets built
and where the nav points. That layer had no tests until two bugs in it shipped:
`astro build` is green whichever slug map it resolves, and E2E only ever sees
whichever config the API happened to serve, so neither stage can see the
difference. Anything in `web/src/lib` with a cache, a retry or a fallback belongs
in `web/src/lib/*.test.ts` (`cd web && pnpm test:unit`); `scripts/test-all.sh`
runs it under the same bitmask bit as the SPA suite.

- Run `make test` automatically after any backend change (models, controllers, migrations, resources).
- Run `make test-all` before every `/ship` or PR.
- Skip only when explicitly told to ("don't run tests" / "quick change") — and say so in the response.
- If tests fail after your change: fix them before reporting done. Distinguish between a **code bug** (fix the source) and a **test bug** (test is outdated — fix the test and explain why).
- **Rebuilds run tests by default.** Use `--skip-tests` to skip them when you're mid-feature and the suite is intentionally broken.

### E2E: a red run is often the machine — check the signature, not free RAM

The suite fails for machine reasons when Chromium and the Vite dev server
cannot get the memory they ask for. **Do not use a free-RAM threshold to
decide this** — the same commit and config produced:

| Reported free RAM | Result |
|---|---|
| 1.4–1.9 GB | 1–3 failures, a different set each run |
| 5.5 GB | 178 passed, 0 failed — 2.3 min |
| **176 MB** | **178 passed, 0 failed — 2.4 min** |

`FreePhysicalMemory` counts only unused pages, not reclaimable ones, so a low
reading does not mean memory is unavailable. An earlier version of this file
claimed a ~2 GB floor; the 176 MB row disproves it.

**Machine-failure signatures** — suspect these before suspecting the code:

- `[vite] http proxy error: /api/...` followed by `Error: read ECONNRESET` —
  **the most common one, and it is not memory.** The dev server's proxy could
  not reach the backend. Downstream, a save succeeds or fails invisibly and the
  spec times out waiting for a toast that never arrives, so the reported failure
  looks like a UI bug. Count them first: `grep -c ECONNRESET` on the run log.
- `FATAL ERROR: Zone Allocation failed - process out of memory` from the dev
  server (the OS refusing an allocation, not V8 hitting its cap — so raising
  `--max-old-space-size` makes it worse)
- `failed to create lease: write /var/lib/docker/buildkit/containerdmeta.db:
  read-only file system`, or `docker exec` returning **nothing at all** — Docker
  Desktop's VM disk has gone read-only. Every image build fails *and* the already
  running backend starts returning 500 because it cannot write. Nothing in the
  code is wrong — see *Docker goes read-only* below, and note that Docker
  Desktop's own Restart button does **not** fix it.
- `GPU process launch failed` from Chromium
- A different set of specs failing each run, or a spec the change cannot reach
- 30-second timeouts rather than assertion mismatches

**Do not assume memory.** Four consecutive runs on one commit failed
`auth`×4, then `concerts`+`shop`, then `releases`+`setlists` — every spec passed
in at least one run, and **no run produced an OOM or GPU signature**. What every
run did produce was ~22 `ECONNRESET`s clustered in its opening minutes, spread
across a dozen unrelated endpoints. An admin page fires 6–10 parallel API calls;
times two Playwright workers plus setup traffic, that lands on
`pm.max_children = 20` in `api/docker/www.conf`. Raising that pool is the
suspected fix and is untested — it trades RAM for connection headroom.

A single red spec that reproduces in isolation is a real failure. A different
pair each run, with resets in the log, is the stack.

Triage order when E2E goes red:

1. **Do the failing specs relate to the change?** A different set each run
   means the machine.
2. **Look for the signatures above.**
3. **Only then investigate the specs.**

If it is the machine, close browser windows and re-run. `workers` is pinned to
2 in `app/playwright.config.ts`; override with `pnpm test:e2e --workers=4`.
~15 tests skip by design (data-dependent guards), so "178 passed, 15 skipped"
is a full green run.

**Do not skip E2E on a low memory reading alone.** Run it; if it fails, triage
with the list above.

**`make` may not be available** — it is absent from the Windows dev setup, so
the `make` targets above are shorthand. Use `bash scripts/test-all.sh
[--skip-e2e|--skip-unit]` directly when `make: command not found`,
which runs frontend unit → backend unit → E2E and returns a bitmask exit code
(1 backend, 2 E2E, 4 frontend).
