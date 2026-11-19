# Welcome Screen & Consent Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cookie strip with a centred consent card (GA only), followed by a configurable, optionally geo-targeted full-page welcome screen promoting gigs, news, the newsletter and fan accounts.

**Architecture:** Settings live in one `site_settings` JSON row (`WelcomeSettings`), copy in a new `welcome` copy-only module row + `@bandms/site-copy` registry; both are baked into the static build via `/api/site-config`. At runtime a Vue island decides whether to show (pure function in `web/src/lib/welcome.ts`, `localStorage`), and — only when targeting is on — asks `GET /api/welcome/nearby`, which locates the IP with MaxMind GeoLite2 on our server.

**Tech Stack:** Laravel 11 + Pest, `geoip2/geoip2`; Astro + Vue 3 islands + nanostores; Vue 3 admin + TanStack Query; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-welcome-screen-design.md`

## Global Constraints

- Branch `feature/welcome-screen`; **one squashed commit, one push** (CLAUDE.md). Per-task commits below are local WIP, squashed before pushing.
- Conventional Commits; final subject: `feat(web): add a welcome screen and a consent card before it`.
- Consent buttons: **equal size, equal style class**; only the label differs. Reject never harder to reach than Accept.
- Welcome row is created **disabled**; `welcome` ∈ `NON_PAGE_MODULES`, ∉ `ALWAYS_ON_MODULES`.
- Settings defaults (verbatim): `{"blocks":["concerts","news","newsletter","account"],"concert_count":2,"frequency":"interval","reshow_days":90,"campaign":0,"geo":{"enabled":false,"radius_km":100,"far_visitors":"hide_gigs"}}`. Bounds: `concert_count` 1–3, `reshow_days` 1–365, `radius_km` 10–1000; `frequency` ∈ `interval|once`; `far_visitors` ∈ `hide_gigs|no_screen`.
- `welcome` served in `/api/site-config` **top-level**, never inside `module_config`.
- Every write that changes baked output calls `SiteRebuild::markDirty('website-modules')`.
- Excluded paths (welcome never opens, consent renders as strip): `/rider/*`, `/{lang}/privacy`, `/account*`, `/newsletter/*`, `/tickets/*`.
- `localStorage` keys: `bandms:consent` (existing), `bandms:welcome` = `{ seenAt: ISO, campaign: number }`. Storage unavailable ⇒ do not show.
- Geo fails open: any lookup failure ⇒ `located: false` ⇒ behave as if targeting off. IP never returned, logged or stored.
- `MAXMIND_LICENSE_KEY` in the backend `environment:` of **both** compose files. Nothing in CI reaches MaxMind.
- Public styling via tokens only (`check-tokens.mjs`); every string through the copy registry (no literal English in `web/src`).
- `Teleport` in islands gated on mount (CLAUDE.md); island props JSON-serialisable.
- `app/` unit tests are `*.spec.ts`; `web/` unit tests are `*.test.ts`.

## Review Focus

1. **Existing public E2E specs blocked by the new modal card** on a GA-configured dev stack → they must keep passing unchanged. Pinned in Task 8 (auth setup seeds storage) — verified by a full public run.
2. **A visitor already signed in as a fan, or arriving on an excluded path from a newsletter/rider link** → no welcome, and no modal consent on excluded paths. Pinned in Task 4 unit tests + Task 8 E2E.
3. **Welcome enabled but every block empty for this visitor** (no upcoming gigs, posts module off, newsletter off, account off; or far visitor with only gigs on) → no screen at all, never an empty dialog. Pinned in Task 4 `selectBlocks`/`shouldShow` tests.
4. **Show-to-everyone pressed, then an ordinary Save** → the campaign must not change on Save, and visitors who saw the new campaign must not see it again. Pinned in Task 1 (PUT ignores `campaign`) + Task 4 test.
5. **Private-mode / storage-blocked browser** → welcome never shows (not on every page); consent behaves as today. Pinned in Task 4 test.

---

### Task 1: `WelcomeSettings`, the `welcome` row, admin endpoints, site-config

**Files:**
- Create: `api/app/Support/WelcomeSettings.php`
- Create: `api/app/Http/Controllers/WelcomeSettingsController.php`
- Create: `api/database/migrations/2026_11_19_000001_add_welcome_website_module.php`
- Modify: `api/database/seeders/DatabaseSeeder.php` (insert the same row, disabled, if the seeder inserts module rows itself — check; otherwise the migration suffices)
- Modify: `api/routes/api.php` (admin group beside `/admin/comment-settings`, `role:admin`)
- Modify: `api/app/Http/Controllers/WebsiteModuleController.php` (`siteConfig()` adds `'welcome' => WelcomeSettings::forBuild()`)
- Test: `api/tests/Feature/WelcomeSettingsTest.php`

**Interfaces:**
- Produces: `WelcomeSettings::get(): array` (normalised full shape, defaults above); `WelcomeSettings::save(array $data): array` (ignores `campaign`); `WelcomeSettings::stampCampaign(): int` (sets `campaign = time()`, returns it); `WelcomeSettings::forBuild(): array` (same as `get()`). Constants `BLOCKS = ['concerts','news','newsletter','account']`, `SETTING_KEY = 'welcome_screen'`.
- HTTP: `GET /api/admin/welcome-settings` → `{data: {...settings, geo_available: bool}}`; `PUT` same body minus `campaign`/`geo_available` → `{data}`; `POST /api/admin/welcome-settings/campaign` → `{data}`. `geo_available` comes from Task 2's `Locator::available()` — in this task return `false` via a temporary `false`, replaced in Task 2.
- `/api/site-config` gains `welcome: {blocks, concert_count, frequency, reshow_days, campaign, geo:{enabled, radius_km, far_visitors}}`.

- [ ] **Step 1: Write failing Pest tests** in `WelcomeSettingsTest.php`:
  - `it('returns defaults when nothing is stored')` → `get()` equals the default JSON in Global Constraints.
  - `it('clamps and filters a stored row')` → stored `{"concert_count":9,"reshow_days":0,"blocks":["news","bogus","news"],"geo":{"radius_km":5,"far_visitors":"x"}}` normalises to `concert_count 3`, `reshow_days 1`, `blocks ["news"]`, `radius_km 10`, `far_visitors "hide_gigs"`.
  - `it('requires an admin')` → guest 401, member 403 on GET/PUT/POST.
  - `it('validates the PUT')` → 422 for `concert_count: 4`, `frequency: 'weekly'`, `blocks: ['bogus']`, `geo.radius_km: 2000`.
  - `it('never changes the campaign on PUT')` → stamp, PUT with `campaign: 1`, campaign unchanged.
  - `it('stamps a new campaign')` → POST returns `campaign` ≥ `now()->timestamp - 5`.
  - `it('serves welcome in site-config beside module_config')` → `getJson('/api/site-config')` has `welcome.frequency`, and `module_config` has no `welcome` key other than the module row's own entry (assert `module_config.welcome` has no `blocks` key).
  - `it('marks website-modules dirty on save and on campaign')` → `SiteDirtyArea` row for `website-modules` exists after each.
  - `it('creates the welcome row disabled')` → `WebsiteModule::where('slug','welcome')->first()->enabled === false`.
- [ ] **Step 2: Run** `docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter WelcomeSettingsTest` — expect FAIL (class not found).
- [ ] **Step 3: Implement** `WelcomeSettings` (pattern: `CommentSettings` — JSON in `SiteSetting`, clamp on read; dedupe and filter `blocks` against `BLOCKS`, preserving order), the migration (`insertOrIgnore` row `slug 'welcome'`, `display_name 'Welcome screen'`, `custom_name {"pl":"Ekran powitalny"}`, `enabled false`, `sort_order 93`), the controller (validate with `Rule::in`, nested `geo.*`), routes, and `siteConfig()`.
- [ ] **Step 4: Run** the same filter — expect PASS. Then the full backend suite (`bash scripts/test-all.sh --skip-e2e`) — expect green.
- [ ] **Step 5: Commit** `git commit -m "feat(api): add welcome screen settings and serve them to the build"`

### Task 2: Geo lookup — `Locator`, `/api/welcome/nearby`, `geoip:update`

**Files:**
- Modify: `api/composer.json` (`geoip2/geoip2:^3.0`)
- Create: `api/app/Support/Geo/Locator.php` (interface), `MaxMindLocator.php`, `Point.php` (readonly `lat`, `lng`)
- Create: `api/app/Http/Controllers/WelcomeNearbyController.php`
- Create: `api/app/Console/Commands/GeoipUpdate.php`
- Create: `api/config/geoip.php` (`license_key` ← `MAXMIND_LICENSE_KEY`, `path` ← `storage_path('app/geoip/GeoLite2-City.mmdb')`)
- Modify: `api/app/Providers/AppServiceProvider.php` (bind `Locator` → `MaxMindLocator`)
- Modify: `api/bootstrap/app.php` `withSchedule()` (`geoip:update` weekly, Wed 04:00 Europe/Warsaw, `withoutOverlapping`)
- Modify: `api/docker/entrypoint.sh` (run `php artisan geoip:update` in the background when the file is missing and the key is set; never block start)
- Modify: `docker-compose.yml`, `docker-compose.prod.yml` (backend `MAXMIND_LICENSE_KEY: ${MAXMIND_LICENSE_KEY:-}`), `.env.example`
- Modify: `api/app/Http/Controllers/WelcomeSettingsController.php` (`geo_available` ← `Locator::available()`)
- Modify: `api/routes/api.php` (public `GET /welcome/nearby`, `throttle:30,1,welcome-nearby`)
- Test: `api/tests/Feature/WelcomeNearbyTest.php`, `api/tests/Support/FakeLocator.php`

**Interfaces:**
- Consumes: `WelcomeSettings::get()['geo']['radius_km']` (Task 1).
- Produces: `interface Locator { public function locate(string $ip): ?Point; public function available(): bool; }` — `locate` returns null for private/unknown IPs and swallows reader exceptions (report once via `report()`, never with the IP). `GET /api/welcome/nearby` → `{ "located": bool, "concert_ids": int[] }` (upcoming = `date >= today`, venue lat/lng non-null, haversine ≤ radius, ordered by date).

- [ ] **Step 1: Write failing tests** (bind `FakeLocator` returning a fixed `Point` or null):
  - `it('returns concerts within the radius')` — visitor at Kraków (50.0647, 19.9450), venues at Kraków and Gdańsk (54.352, 18.6466), radius 100 → only the Kraków concert id.
  - `it('excludes past concerts and venues without coordinates')`.
  - `it('reports located false when the locator cannot place the ip')` → `{located:false, concert_ids:[]}`.
  - `it('never echoes coordinates or the ip')` → response JSON has exactly the keys `located`, `concert_ids`.
  - `it('reports geo_available from the locator')` on `GET /api/admin/welcome-settings`.
  - `it('geoip:update exits cleanly without a key')` → `artisan('geoip:update')->assertExitCode(0)` and outputs a "no licence key" line; uses `Http::fake()` for a keyed run that writes the extracted file (fake a tar.gz fixture built in the test).
- [ ] **Step 2: Run** `--filter WelcomeNearbyTest` — expect FAIL.
- [ ] **Step 3: Implement.** `MaxMindLocator::locate` uses `GeoIp2\Database\Reader::city($ip)`, catches `AddressNotFoundException`/`InvalidDatabaseException`/missing file → null; `available()` = file exists. `GeoipUpdate` downloads `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&suffix=tar.gz` with the key in **basic auth or the documented header, never logged**, extracts the `.mmdb` with `PharData` to a temp path, then `rename()` into place (atomic). Haversine in the controller, Earth radius 6371 km.
- [ ] **Step 4: Run** `--filter WelcomeNearbyTest` → PASS; full backend suite → green. On the dev stack, confirm `request()->ip()` is the browser's, not Caddy's: temporarily `curl -s localhost:8081/api/welcome/nearby` and check `docker logs` is silent about IPs.
- [ ] **Step 5: Commit** `git commit -m "feat(api): locate visitors by ip to find nearby gigs"`

### Task 3: Copy registry — `WELCOME_COPY` and privacy additions

**Files:**
- Create: `packages/site-copy/src/modules/welcome.ts`
- Modify: `packages/site-copy/src/modules/privacy.ts`, `packages/site-copy/src/index.ts`
- Test: `packages/site-copy/src/resolve.spec.ts` (extend)

**Interfaces:**
- Produces: `WELCOME_COPY` with keys `heading`, `intro`, `gigsTitle`, `gigsNearTitle`, `newsTitle`, `newsletterTitle`, `newsletterBody`, `newsletterPlaceholder`, `newsletterSubmit`, `newsletterSending`, `newsletterDone`, `newsletterError`, `accountTitle`, `accountBody`, `accountPlaceholder`, `accountSubmit`, `accountSending`, `accountDone`, `accountError`, `enter`, `close`. Groups: `Intro`, `Gigs`, `News`, `Newsletter`, `Account`, `Buttons`. All with en + pl defaults (wording left to the builder; `heading` may use `{band}`).
- `PRIVACY_COPY` adds `bannerTitle` (group *Cookie banner*, default en "Help us plan the next tour" / pl "Pomóż nam zaplanować trasę"), `locationHeading`, `locationBody` (group *Policy page*); `bannerAccept` default → "Allow"/"Zezwalam", `bannerReject` → "No thanks"/"Nie, dziękuję", `bannerBody` → the honest touring pitch from the spec. **Keys are not renamed.**

- [ ] **Step 1: Failing test** in `resolve.spec.ts`: `WELCOME_COPY` keys equal the list above; every field has non-empty `en` and `pl` defaults except none (all filled); `PRIVACY_COPY` still contains `bannerBody`, `bannerAccept`, `bannerReject`, `bannerLink` (pinned keys) plus the three new ones.
- [ ] **Step 2: Run** `cd app && pnpm vitest run ../packages/site-copy` → FAIL.
- [ ] **Step 3: Implement** the registry entries.
- [ ] **Step 4: Run** → PASS; test count went up.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add welcome screen copy and friendlier consent defaults"`

### Task 4: The show rule — `web/src/lib/welcome.ts`

**Files:**
- Create: `web/src/lib/welcome.ts`, `web/src/lib/welcome.test.ts`
- Modify: `web/src/lib/cms.ts` / `web/src/types/shared.ts` (type `SiteConfig.welcome?: WelcomeConfig`)

**Interfaces:**
- Produces (all pure, no DOM):
  ```ts
  export type WelcomeBlock = 'concerts' | 'news' | 'newsletter' | 'account'
  export interface WelcomeConfig { blocks: WelcomeBlock[]; concert_count: 1|2|3; frequency: 'interval'|'once'; reshow_days: number; campaign: number; geo: { enabled: boolean; radius_km: number; far_visitors: 'hide_gigs'|'no_screen' } }
  export interface WelcomeSeen { seenAt: string; campaign: number }
  export const EXCLUDED_PATHS: RegExp[]          // the five in Global Constraints
  export function isExcludedPath(pathname: string): boolean
  export function isDue(seen: WelcomeSeen | null, cfg: WelcomeConfig, now: Date): boolean
  export function selectBlocks(cfg: WelcomeConfig, available: Record<WelcomeBlock, boolean>, nearby: { located: boolean; concertIds: number[] } | null, upcomingIds: number[]): { blocks: WelcomeBlock[]; concertIds: number[] } | null   // null = no screen
  export function readSeen(storage: Storage | null): WelcomeSeen | null | 'unavailable'
  export function writeSeen(storage: Storage | null, campaign: number, now: Date): void
  ```
  `available` = block enabled-and-has-data from the build (module gates). `nearby === null` means targeting off or not asked. Located + no near concert: `hide_gigs` drops `concerts`; `no_screen` returns null. Not located: fall back to the first `concert_count` of `upcomingIds`. Returns null when no block remains.

- [ ] **Step 1: Failing tests** (`welcome.test.ts`):
  - each excluded path true (`/rider/abc`, `/en/privacy`, `/pl/privacy/`, `/account?x=1` via pathname `/account`, `/newsletter/confirm/t`, `/tickets/x`); `/en`, `/en/concerts` false.
  - `isDue`: null → true; interval 90 with seenAt 89 days ago → false, 91 → true; `once` with seenAt 3 years ago and same campaign → false; different campaign → true in both modes.
  - `selectBlocks`: geo off → first `concert_count` upcoming; located near → only near ids, capped; located far + `hide_gigs` → no `concerts`, others kept; far + `no_screen` → null; not located → fallback; all blocks unavailable → null; far + `hide_gigs` + only `concerts` enabled → null; order follows `cfg.blocks`.
  - `readSeen(null)` → `'unavailable'`; a storage whose `getItem` throws → `'unavailable'`; corrupt JSON → null.
- [ ] **Step 2: Run** `cd web && pnpm test:unit -- welcome` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(web): decide when the welcome screen is due and what it shows"`

### Task 5: Consent card (modal) and strip (excluded paths)

**Files:**
- Modify: `web/src/components/ConsentBanner.vue`, `web/src/layouts/BaseLayout.astro` (pass `title`, keep GA gating)
- Modify: `app/e2e/tests/public/consent-banner.spec.ts`

**Interfaces:**
- Consumes: `isExcludedPath` (Task 4), `PRIVACY_COPY.bannerTitle` (Task 3).
- Produces: `ConsentCopy` gains `title: string`. Card: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title, focus trapped, Esc ignored, dimmed backdrop (token colour), Teleport gated on mount. Strip (excluded path): today's markup, `role="region"`. Both buttons carry the same class (`consent-btn`) and a `data-testid` (`consent-allow`, `consent-reject`).

- [ ] **Step 1: Update the spec first**: locate by `getByTestId('consent-allow')`; add `test('Allow and No thanks are the same size')` comparing `boundingBox()` width/height (±1px); add `test('shows as a non-blocking strip on the privacy page')` (`/en/privacy` → `getByRole('region')` visible, no `dialog`); keep the skip-when-GA-unset guard.
- [ ] **Step 2: Run** `cd app && pnpm exec playwright test e2e/tests/public/consent-banner.spec.ts` against a rebuilt web image — FAIL (or skipped if GA unset: then set `PUBLIC_GA_MEASUREMENT_ID` in `.env` for the run).
- [ ] **Step 3: Implement** the two layouts in one component, chosen by `isExcludedPath(location.pathname)` on mount.
- [ ] **Step 4: Rebuild** (`docker compose build web && docker compose up -d web`, confirm the asset hash changed per CLAUDE.md) and re-run → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(web): turn the cookie strip into an even-handed consent card"`

### Task 6: `WelcomeScreen.vue` island and build wiring

**Files:**
- Create: `web/src/components/WelcomeScreen.vue`
- Modify: `web/src/layouts/BaseLayout.astro`, `web/src/lib/copy.ts` (a `welcomeCopy()` shaper), `web/src/pages/[lang]/privacy.astro` (location paragraph when `siteConfig.welcome?.geo.enabled`)
- Test: `web/src/lib/contentWidth.test.ts` unaffected; build check in Step 4

**Interfaces:**
- Consumes: Tasks 3–5; `consentStatus` atom; `readFanSession`, `rememberReturnPath`, `requestSignInLink` from `web/src/lib/comments.ts`; `NewsletterSignup.vue` (copy via props).
- Produces island props (JSON): `{ lang, config: WelcomeConfig, gaConfigured: boolean, concerts: {id, date, city, venue, href}[], post: {title, date, image, href} | null, available: Record<WelcomeBlock, boolean>, copy: WelcomeCopy }`. `concerts` = all upcoming (cap 50) when `geo.enabled`, else first `concert_count`. `available` applies module gates with `!== false`: `concerts`, `posts`, `newsletter`; `account` always true.
- BaseLayout mounts it `client:idle` only when `siteConfig.modules.welcome === true` (explicit true — the row is created disabled; absent key must not show it) and `concerts.length || post || available.newsletter || available.account`.

- [ ] **Step 1: Implement the island**: on mount — bail if `isExcludedPath`, if `readFanSession()` has a token, if `readSeen` is `'unavailable'` or `!isDue`; if `gaConfigured`, wait until `consentStatus !== 'unknown'` (watch the atom); if `config.geo.enabled`, `fetch('/api/welcome/nearby')` (any error ⇒ `{located:false}`); run `selectBlocks`; if null, stop; else `writeSeen` and open. Dialog: `role="dialog"`, `aria-modal`, labelled by heading, focus trap, closes on Enter-the-site/✕/Esc/backdrop, restores focus, `prefers-reduced-motion` respected. Account block: `rememberReturnPath(location.pathname)` then `requestSignInLink(email, lang, location.pathname)`.
- [ ] **Step 2: Wire BaseLayout** (fetch upcoming via `getConcerts(lang)` + `isUpcoming`, latest post via `getPosts(lang)` — both memoised already; hrefs via `slugMap`/`postSlug`).
- [ ] **Step 3: Build against the live API**: `cd web && API_BASE=http://localhost:8081 pnpm build` → green; `grep -rl undefined dist --include=*.html` → empty; `npx tsc --noEmit -p tsconfig.json` → only the two known errors.
- [ ] **Step 4: Commit** `git commit -m "feat(web): show a welcome screen with gigs, news, newsletter and account"`

### Task 7: Admin panel

**Files:**
- Create: `app/src/api/welcomeSettings.ts`, `app/src/composables/useWelcomeSettings.ts`, `app/src/components/admin/WelcomeSettingsPanel.vue`, `app/src/types/welcome.ts`
- Create: `app/src/utils/welcomeSettings.ts` + `app/src/utils/welcomeSettings.spec.ts` (form ↔ payload: block order/toggle helpers)
- Modify: `app/src/config/moduleSettings.ts` (`NON_PAGE_MODULES` += `'welcome'`), `app/src/views/admin/WebsiteModulesView.vue` (render the panel in the `welcome` row's editor), i18n catalogues (en + pl)
- Test: `app/e2e/tests/admin/welcome-screen.spec.ts`

**Interfaces:**
- Consumes: Task 1/2 endpoints.
- Produces: `useWelcomeSettings()` → `{ query, save, stampCampaign }` (TanStack; `stampCampaign` invalidates `['welcome-settings']`). Test ids: `welcome-settings`, `welcome-block-<key>` (checkbox), `welcome-block-up-<key>`/`-down-<key>` (order buttons — accessible alternative to drag), `welcome-concert-count`, `welcome-frequency-interval|once`, `welcome-reshow-days`, `welcome-campaign` (button) + `welcome-campaign-last`, `welcome-geo-enabled`, `welcome-geo-radius`, `welcome-geo-far-hide_gigs|no_screen`, `welcome-geo-status`, `welcome-save`.
- The campaign button asks for an in-page confirm (inline "Show again to everyone? Confirm / Cancel", no `confirm()`), and notes that visitors see it after the next rebuild when auto-rebuild is off.

- [ ] **Step 1: Failing vitest** for `utils/welcomeSettings.ts`: `moveBlock(order, key, -1|1)`, `toggleBlock(enabled, order, key)` keep `BLOCKS` order stable and output only enabled keys in display order.
- [ ] **Step 2: Failing E2E** `welcome-screen.spec.ts`: captures settings via API (Bearer from storage-state file, throwing on failure — CLAUDE.md), toggles `news` off, moves `newsletter` up, sets count 3, frequency once, radius 150, saves, reloads → values persist; presses campaign → `welcome-campaign-last` shows today; `afterAll` PUTs the captured settings back and asserts 200.
- [ ] **Step 3: Implement**; run `cd app && rm -f tsconfig.*.tsbuildinfo && pnpm build`, `pnpm test:unit`, the E2E file → all PASS.
- [ ] **Step 4: Commit** `git commit -m "feat(admin): configure the welcome screen from website modules"`

### Task 8: E2E isolation and the public welcome spec

**Files:**
- Modify: `app/e2e/tests/setup/auth.setup.ts` (before `storageState()`, visit `E2E_WEB_URL` and `localhost:8081`, set `bandms:consent` = denied-now and `bandms:welcome` = `{seenAt: now, campaign: 9999999999}`)
- Create: `app/e2e/tests/public/welcome-screen.spec.ts`

**Interfaces:**
- Consumes: everything above. The spec uses `test.use({ storageState: { cookies: [], origins: [] } })`, enables the row and settings via API in `beforeAll` (restores in `afterAll`), triggers + polls the rebuild webhook (memory: public E2E needs rebuild-and-wait), `describe.serial`, and serves `/api/welcome/nearby` with `page.route`. It joins a chained single-file project after `welcome-screen` admin if they share the row (playwright.config.ts).

- [ ] **Step 1: Write tests:** first visit shows consent card then welcome (GA set) or welcome alone (GA unset); welcome opens after *No thanks*; ✕ closes and next page does not reopen; `/en/privacy` and `/rider/x` never show it; signed-in fan (`localStorage fan_token`) never sees it; campaign stamp + rebuild → a visitor with an old seen campaign sees it again; near → gigs block lists only the routed id; far + `hide_gigs` → no gigs block; far + `no_screen` → no dialog.
- [ ] **Step 2: Run** the spec → PASS. Then the whole suite split per memory (chromium, then chains) → green, same pass count as `main` plus the new tests.
- [ ] **Step 3: Commit** `git commit -m "test(e2e): cover the welcome screen and keep it out of other specs"`

### Task 9: Docs, review, ship prep

**Files:**
- Modify: `CLAUDE.md` (short section: welcome screen settings/`campaign`/geo fail-open/`MAXMIND_LICENSE_KEY` in both compose files/E2E storage seeding), `CHANGELOG.md`, `docs/deployment.md` (MaxMind key step)

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2:** `bash rebuild.sh` (full: compose + backend changed) → all steps green; confirm `docker exec bandms_backend printenv MAXMIND_LICENSE_KEY` arrives when set.
- [ ] **Step 3:** `bash scripts/test-all.sh` → exit 0.
- [ ] **Step 4:** Run `/code-review`; apply fixes; check `git status` for stray review files.
- [ ] **Step 5:** `git reset --soft main && git commit` with the subject in Global Constraints and a body carrying the why; stop before pushing for the user's go-ahead.
