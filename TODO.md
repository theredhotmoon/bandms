# TODO

Open work, most important first. Each item says enough to pick it up cold.

---

## Point the domain at the server — `skankingstorks.band`

**Status:** domain registered at GoDaddy, nothing configured. The server still
runs on `SITE_ADDRESS=:80`, reachable only by bare IP. Everything in the repo is
ready — the Caddyfile handles TLS and the www redirect (#56), and
`PUBLIC_CARTO_KEY` is wired (#55). What is left is DNS plus a `.env` edit.

Do the `PUBLIC_CARTO_KEY` line in the same sitting: it lives in the same file and
needs the same `web` recreate, so splitting it means doing the server work twice.
Until it is set, the concert maps render but every tile reads "API KEY REQUIRED".

**Prerequisite:** the server's public IPv4, from the Hetzner Cloud console (same
value as the `SERVER_HOST` GitHub secret). Ports **80 and 443** must be open in
the Hetzner Cloud Firewall and in any `ufw` on the box — the ACME HTTP-01
challenge needs port 80 specifically, even though the site ends up on 443.

### 1. DNS at GoDaddy

Sign in → avatar → **My Products** → `skankingstorks.band` → **DNS**. That is the
**DNS Management** records table. Avoid the "Connect to a service" / Domain
Connect shortcuts — they are for hosted platforms and write records you do not
want.

A fresh GoDaddy domain ships with parked records that must be replaced, not
added to:

| Type | Name | Ships as | Do |
|---|---|---|---|
| A | `@` | a GoDaddy parking IP (`76.223.x.x` / `13.248.x.x`) | **edit** → server IPv4 |
| CNAME | `www` | `@` or a GoDaddy host | **delete**, add an A record instead |
| CNAME | `_domainconnect` | `_domainconnect.gd.domaincontrol.com` | leave |
| NS / SOA | | GoDaddy nameservers | leave |

Target state — TTL 600 while setting up (GoDaddy's TTL dropdown has a **Custom**
option), raised to an hour once stable:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `SERVER_IPV4` | 600 |
| A | `www` | `SERVER_IPV4` | 600 |

**Edit the existing `@` record rather than adding a second one.** Two A records
on `@` round-robin, so roughly half of all visitors land on the parking page —
an intermittent failure that is genuinely nasty to diagnose.

**`www` needs a real DNS record even though it only ever redirects.** The
redirect happens in Caddy, on this server, so the request has to arrive here
first. Without the record the browser fails to connect and never sees a
redirect at all.

Only add an `AAAA` record if the server genuinely serves on IPv6. A wrong AAAA
is worse than none: browsers prefer IPv6 and will hard-fail rather than fall
back to the working IPv4.

**Do not enable GoDaddy Forwarding, Website Builder or Parking.** Forwarding
intercepts at GoDaddy's edge and breaks both the ACME challenge and HTTPS; the
other two re-point `@` back at GoDaddy. Ignore any "your domain isn't connected"
prompt — it wants to overwrite these records.

### 2. Verify DNS before touching the server

```bash
nslookup skankingstorks.band
nslookup www.skankingstorks.band
```

Both must return the server IP. GoDaddy usually propagates in 5–30 minutes.

**Wait for this.** Caddy attempts ACME the instant it starts with a hostname,
and Let's Encrypt rate-limits *failed* validations at 5 per hostname per hour —
a premature attempt can lock you out for an hour.

### 3. Server `.env`

```bash
ssh deploy@SERVER && cd /opt/bandms
cp .env .env.bak.$(date +%F)
nano .env
```

```bash
SITE_ADDRESS=skankingstorks.band, www.skankingstorks.band
APP_URL=https://skankingstorks.band
PUBLIC_CARTO_KEY=<key from https://carto.com/basemaps/apikey>
```

`SITE_URL` and `FRONTEND_URL` both fall back to `APP_URL`, so those two lines are
enough. `FRONTEND_URL` matters beyond routing: it is the CORS allowed origin and
every link in outgoing email.

The deploy never writes `/opt/bandms/.env` — it copies only
`docker-compose.prod.yml`, the Caddyfile and `scripts/prod-backup-db.sh`. This
file is persistent server state, so the edit survives deploys and has to be made
by hand.

### 4. Recreate, in this order

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate web
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate caddy
```

Backend first: its entrypoint runs `php artisan optimize`, baking `APP_URL` into
the config cache for the container's lifetime. Web next: it rebuilds the Astro
site at startup, picking up `SITE_URL` for the sitemap and canonical tags and
`PUBLIC_CARTO_KEY` for the maps. Caddy last: it triggers certificate issuance.

**A restart is not enough for any of them** — it reuses the container with its
old environment and reports success. Caddy additionally needs `--force-recreate`
because its Caddyfile is a bind mount, and a mounted file's *contents* are not
part of the service-definition hash Compose diffs against.

### 5. Verify

```bash
docker logs bandms-caddy 2>&1 | tail -30     # "certificate obtained successfully"

curl -I https://skankingstorks.band/
curl -sI https://www.skankingstorks.band/ | head -3          # expect 301 → apex
curl -s  https://skankingstorks.band/api/health
curl -o /dev/null -w '%{http_code}\n' https://skankingstorks.band/admin
```

Check `/admin` specifically — it exercises the `@spa` matcher and its
`/assets/*` entry, the route that broke in #47.

For the CARTO key, `printenv` only proves it reached the container; the value is
compiled into the site's JavaScript, so check the served bundle and then look at
the page:

```bash
docker exec bandms-web printenv PUBLIC_CARTO_KEY
curl -s https://skankingstorks.band/en/concerts | grep -o '/_astro/ShowsMap[^"]*\.js' | head -1
curl -s https://skankingstorks.band/_astro/ShowsMap.<hash>.js | grep -c 'key='   # 1 = baked in
```

An unkeyed tile still returns `200 OK` with a valid PNG — it is simply
watermarked — so no status check can confirm this. Only your eyes can.

### Expect these, they are not faults

- **The bare IP stops working.** Caddy answers only for hostnames it is given,
  so `http://SERVER_IP/` no longer serves the site.
- **A deploy takes the site down for ~20–60s** while `web` force-recreates and
  Astro rebuilds.
- Certificates live in the `caddy-data` named volume, so they survive recreates.
  Recreating Caddy does not re-issue and cannot burn rate limit.

Fuller version in `README.md` → *Pointing a domain at the server* and *Changing
an environment variable on the server*. Related: the Hetzner runbook under
*Production deployment* below.

---

## Pre-sale early access — designed, not built

**Status:** design approved, no implementation. Spec: [`docs/superpowers/specs/2026-08-23-presale-early-access-design.md`](docs/superpowers/specs/2026-08-23-presale-early-access-design.md)

**The problem:** pre-sale shipped as a shell. There are codes, a `presale_code_tiers` pivot, admin CRUD and a `POST /api/presale-codes/validate` endpoint — but nothing marks a ticket as gated, hides it, or refuses to sell it. `ConcertTicketController` and `CheckoutController` have zero presale references, and `used_count` is never incremented. Two Vue components (`PresaleCodeManager.vue`, `PresaleUnlockWidget.vue`) were built against gating that was never implemented and are still unreferenced.

**What was decided:** a code means *early access before public on-sale* — it shifts when you may buy, not what you pay. No new gating flag; `available_from` already expresses "not yet on sale". The code travels with the request (listing query param, checkout payload) and is re-validated server-side in both places, so the client's unlocked state is presentation only.

**Next step:** write the implementation plan from the spec.

**Two judgement calls to revisit when building:** `max_uses` is checked at checkout rather than reserved (a code can finish slightly over its limit), and `PresaleUnlockWidget.vue` gets deleted rather than wired — the Astro concert page has no Vue runtime, so the input is reimplemented inline.

---

## Public site — only Shop is left

Every page and both pieces of chrome are now ported. Shop is the only thing left.

### Shop — designed, not built

**Status:** planned, not started. Plan: [`docs/superpowers/specs/2026-08-27-shop-page-plan.md`](docs/superpowers/specs/2026-08-27-shop-page-plan.md)

`MerchSection.astro` and `MerchItemDetail.astro`. Deferred to last on purpose:
Shop is the only remaining page wired to Stripe, so postponing it postpones the
only real regression risk. **Restyle only** — no changes to cart logic, totals or
the checkout call, and the existing shop E2E specs are the gate.

All the data already exists (variants with per-variant stock, multi-currency
prices, presale and ship dates, `purchase_url`, photos), so no backend work is
expected. **One question to settle first:** the design carries a PLN/EUR currency
switcher — confirm the cart and `CheckoutController` actually support choosing a
currency. If they assume one, the switcher is cosmetic and must be dropped rather
than shipped as a control that changes a label but not the charge.

### Follow-up: four pages still hold their own hero

`PageHero.astro` was extracted while restyling the undesigned pages, but Contact,
Music, Gallery and About still carry inline copies of the same ink header. A
scripted migration silently dropped Contact's hero buttons and pills, so it was
reverted — this wants a reviewed diff per file, not a regex.

---

## Other open items

### E2E flakiness is connection resets, not memory
Every full run loses ~2 specs, a different pair each time, always downstream of `[vite] http proxy error … ECONNRESET` — never an assertion mismatch. No OOM or GPU signatures in any run. Suspected cause is `pm.max_children = 20` in `api/docker/www.conf`: an admin page fires 6–10 parallel API calls, times two Playwright workers plus setup traffic. **Untested** — raising the pool trades RAM for connection headroom. Documented in `CLAUDE.md`.

### `--prefer-source` makes builds ~8× slower and fragile
`api/Dockerfile` uses `composer install --prefer-source`, which git-clones every package instead of downloading zips. Observed: one composer step took **51 minutes** and then died on a single DNS blip. `--prefer-dist` would fix both. It was introduced in PR #10; worth checking whether whatever prompted it still applies.

### Production deployment — wired, not yet run
`docs/deployment.md` is the Hetzner runbook — also published as a shareable page with a progress-saving verification checklist: [BandMS Deploy Runbook](https://claude.ai/code/artifact/1573a8d4-01c1-4518-bf57-10e09edecf3b). The audit that produced it fixed: the missing `web` service (the Astro site was absent from prod entirely), Caddy TLS via `SITE_ADDRESS`, MySQL never starting on a first deploy, the seeded `admin@bandms.test` / `password` account, missing `trustProxies` (which collapsed the per-IP login throttle into one global bucket), Passport keys not surviving a deploy, unconfigured mail, and `APP_FRONTEND_URL` — a variable distinct from `FRONTEND_URL`, read only by `config/services.php`, that sent every Stripe redirect to `localhost:5173`.

**Still open:**
- **No E2E in CI.** The workflow runs backend + frontend unit tests only. E2E needs a full stack in the runner.
- **The rebuild webhook (`web:3001`) has no auth.** Unreachable from the internet — not published, not proxied by Caddy — but any container on the `bandms` network can trigger unlimited rebuilds.
- **`docker-compose.yml` sets `APP_ENV: production` for the local stack.** Harmless today but it means no `app()->environment()` check can distinguish dev from prod; the seeder gates on explicit env vars for exactly this reason.
- **No automated database backups.** The runbook gives the `mysqldump` command; nothing schedules it.

### Pre-sale items are invisible on the public shop
`GET /api/shop` filters `where('is_available', true)`, so a presale-only item (`is_available = false`, `is_presale = true`) never reaches the public site. `merch/index.astro` filters `is_available || is_presale` and renders a "presale" badge — code that can never fire — and `GET /api/shop/by-slug/{slug}` 404s the same items, so a shared link to one is dead.

Found while fixing the merch build crash. Deliberately **not** fixed there: making presale items public is a product decision, not a bug fix, and it changes what a live public site displays. The three layers currently disagree about what presale means; pick one and make them agree.

### Admin routes return 500 instead of 401
Any admin route without an `Accept: application/json` header returns 500, not 401 — Laravel's auth middleware trying to redirect to a `login` named route that does not exist in an API-only app. Verified across five endpoints. Needs an exception-handler fix.

### A 429 is reported to users as a server error
`POST /api/auth/login` returns `{"message": "Too Many Attempts."}` when throttled, but the login page renders **"Internal Server Error"**. The SPA collapses an unrecognised status into a generic message, so a rate-limited user is told the server broke instead of to wait a minute.

### Docker housekeeping
`docker system df` errors on a corrupt build-cache record left over from a disk-full incident (`too many levels of symbolic links`) — builds work, only the accounting fails. Separately, the WSL2 disk at `%LOCALAPPDATA%\Docker\wsl\data\ext4.vhdx` stays ~175 GB after pruning; WSL2 disks never shrink on their own and need explicit compaction to return the space to Windows.

### Stale branches
`astro-restoration-wip` has 2 unmerged commits (tip is literally *"WIP: Save Astro page restoration work before reverting"*) — not merged anywhere, so deleting it loses work. The agent worktree at `.claude/worktrees/agent-ab3efffd3d61327c7` holds 14 uncommitted modified files.

### Known issues carried from the ticket platform (PR #36)
- dompdf does not support `display:flex`/`gap`, so the `.row` layout in `pdf.blade.php` stacks instead of sitting side by side. Cosmetic.
- UUID regex is loose in `qrCode()`/`walletGoogle()` and strict in `pdf()`/`walletApple()`. Cosmetic inconsistency, no security impact.
- Bulk pre-sale code generation has no intra-batch collision guard. Astronomically unlikely at `count <= 100`.
- `PresaleUnlockWidget` label is not programmatically associated with its input (missing `for`/`id`). Accessibility.
- Some ticket tests call `ConcertTicketType::create()` directly rather than using a factory.

### The public site has no type-check gate
`app/` is gated by `vue-tsc` on every build; `web/` is not. `astro check` needs
`@astrojs/check`, which is not installed, and `pnpm build` only runs the token
lint plus the Astro build — neither of which reads a type annotation. This is the
mechanism behind the "types lie" footgun in `CLAUDE.md`: four `web/src/types`
interfaces claimed fields the API never sent, and one of them crash-looped the
container for two months. Installing `@astrojs/check` and adding it to `build`
would close it; expect a first run to surface a backlog.

### Public-site E2E is thin, not absent
Eight specs now cover the public Astro site on `:4322` (contact, availability,
music, gallery, about, release detail, footer, the restyled pages). The **public
ticket purchase flow still has none** — the one path on that site that takes
money. Everything else on `:5173` targets the admin SPA.
