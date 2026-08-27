# TODO

Open work, most important first. Each item says enough to pick it up cold.

---

## Pre-sale early access — designed, not built

**Status:** design approved, no implementation. Spec: [`docs/superpowers/specs/2026-08-23-presale-early-access-design.md`](docs/superpowers/specs/2026-08-23-presale-early-access-design.md)

**The problem:** pre-sale shipped as a shell. There are codes, a `presale_code_tiers` pivot, admin CRUD and a `POST /api/presale-codes/validate` endpoint — but nothing marks a ticket as gated, hides it, or refuses to sell it. `ConcertTicketController` and `CheckoutController` have zero presale references, and `used_count` is never incremented. Two Vue components (`PresaleCodeManager.vue`, `PresaleUnlockWidget.vue`) were built against gating that was never implemented and are still unreferenced.

**What was decided:** a code means *early access before public on-sale* — it shifts when you may buy, not what you pay. No new gating flag; `available_from` already expresses "not yet on sale". The code travels with the request (listing query param, checkout payload) and is re-validated server-side in both places, so the client's unlocked state is presentation only.

**Next step:** write the implementation plan from the spec.

**Two judgement calls to revisit when building:** `max_uses` is checked at checkout rather than reserved (a code can finish slightly over its limit), and `PresaleUnlockWidget.vue` gets deleted rather than wired — the Astro concert page has no Vue runtime, so the input is reimplemented inline.

---

## Public site — the footer and Shop are left

The 2-Tone design has been ported page by page (Contact, Music, Gallery, About,
Article press, ReleaseDetail, and the four undesigned sections). What is left is
the site footer and Shop.

### `Footer.astro` was never ported — do this first

**Status:** not started. Small, but it shows on every page.

`web/src/components/Footer.astro` is still the pre-theme footer: `border-t
border-border mt-24 py-12`, a `font-black` brand link, no scoped styles. Every
other piece of chrome is 2-Tone, so an ink header now bookends a plain footer on
all 25 pages.

The design's footer (`SiteFooter` in `variants/shared.jsx`) is: ink ground, a
checker strip pinned to the top edge, a `1.3fr 1fr 1fr` grid of brand+socials /
booking / nav, accent column headings at Anton 26px, brand at Anton 30px, and a
bottom bar at `600 13px/1`.

Found while testing ReleaseDetail — its "no pre-theme classes" assertion caught
the footer and had to be scoped to `<main>` so it judged the page rather than
someone else's file. Widen that assertion back to the whole document once the
footer is ported.

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

### No E2E coverage of the public site
Every spec targets the admin SPA on `:5173`. The Astro site on `:4322` — including the public ticket purchase flow — has none, and covering it needs a second Playwright project.
