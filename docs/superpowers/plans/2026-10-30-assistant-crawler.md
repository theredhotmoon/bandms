# Assistant phase 3 — Crawler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A nightly, capped crawl of declared sources into one `assistant_findings` table, triaged by `TextModel::structured()`, shown in an admin inbox grouped by country with *Save as Venue/Band/Author*, and summarised in a Monday digest.

**Architecture:** `App\Assistant\Crawler`: a `Source` contract with one class per source, a `CapLedger` counting queries per source per Warsaw day (and month), `CrawlSourceJob`/`TriageFindingsJob`/`SendDigestJob` on the existing queue, three artisan commands on a new `schedule:work` supervisord program. Settings in `site_settings.assistant_crawler` through `CrawlerSettings`. Admin: `/admin/assistant` (inbox) and `/admin/assistant/settings`. Four PRs (slices).

**Tech Stack:** Laravel 11 (queue `database` in prod, `sync` in dev), Pest with `Http::fake()` fixtures, phase 2's `TextModel`; Vue 3 admin with TanStack Query, vitest; Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-assistant-crawler-design.md`.

## Global Constraints

- Every source class: `key()`, `enabled(CrawlerSettings)` (false without its key — reported, never thrown), `queries(settings): iterable<Query>`, `fetch(Query): Finding[]`; runs under `CapLedger::take(key, n)`; one `assistant_runs` row per source per run with `status ok|capped|failed`.
- Caps are per **calendar day in Europe/Warsaw** (Places also per month); a manual run spends the remainder. Defaults: google_cse 80/day, youtube 20 searches/day, setlistfm 40/day, places 30/day + 900/month, meta_own 5/day, reddit 20/day, rss 1/feed.
- Findings store URL, title ≤500, snippet ≤500, the source's id as `external_key`, trimmed `payload`; **never** page bodies. `unique(source, external_key)`; upsert never resets `status`.
- No Meta scraping: `meta_own` reads only `/{page-id}/tagged` and `/{ig-user-id}/tags` with `FACEBOOK_PAGE_ACCESS_TOKEN`. IG `mentioned_media` is out.
- Feed fetches go through `SafeUrl::get()`; API calls through `Http::timeout(15)`.
- Keys: `GOOGLE_API_KEY`, `GOOGLE_CSE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_USER_ID`, `REDDIT_CLIENT_ID/SECRET`, `ASSISTANT_TRIAGE_MODEL` (optional, falls back to `ASSISTANT_TEXT_MODEL`) in both compose files, `.env.example`, deployment table.
- Triage summary in `ContentLocales::primary()`; items `relevant:false` keep `score 0` and are hidden behind a toggle, never deleted.
- Admin conventions as before; the inbox view stays thin (components for the row, the filters, the save-as flow).
- One squashed commit and one push per slice; `/code-review` before each merge.

## Review Focus

1. **A finding the band dismissed last week reappears in tonight's results** — must stay `dismissed` (upsert keeps status): Slice 1 `CrawlRunTest`.
2. **Google answers 429 mid-run** — the source ends `capped`, other sources still run, the inbox header says so: Slice 1 `GoogleCseSourceTest` + `CrawlRunTest`.
3. **A manual run after the nightly one** spends only the day's remainder (Places also the month's): Slice 2 `CapLedgerTest`.
4. **Save as Venue for a name that already exists** (`venues.name` is unique) — the quick-add shows the 422 inline and the finding stays `new`: Slice 3 E2E.
5. **The digest with nothing new** sends nothing (no empty Monday mail): Slice 4 `DigestTest`.

---

## Slice 1 — schema, settings, scheduler, first two sources, inbox list

### Task 1: Schema and models

**Files:** migrations for `assistant_findings`, `assistant_runs`, `venues.country/website`, `bands.kind/country`, `venues/bands/authors.source`; models `AssistantFinding` (casts: `triage`,`payload` array; scopes `kind()`, `country()`, `status()`), `AssistantRun`; factories; `Venue`/`Band`/`Author` `$fillable` + resources + form requests gain the new columns; `VenueForm.vue`/`BandForm.vue` gain inputs (country select from the countries table — Task 2's `countries.php` mirrored as `app/src/utils/countries.ts`, pinned by a spec that reads the PHP file).
**Tests:** `VenueTest`/`BandTest` round-trip the new columns; factory states `->lead()`, `->dismissed()`.
Commit `feat(api): add assistant findings and lead columns`.

### Task 2: `CrawlerSettings` + countries table + settings endpoints

**Interfaces:**
```php
final class CrawlerSettings { // over SiteSetting 'assistant_crawler'
  public static function get(): array;   // normalised: keywords[], countries[], cities_by_country{}, sources{key: {enabled, cap}}, rss_feeds[], sibling_bands[{mbid,name}], digest_to[], run_at 'HH:MM'
  public static function set(array $input): array;   // validates, merges, returns normalised
  public static function keyMissing(string $sourceKey): bool;   // which env key a source lacks
}
config/countries.php: ['PL' => ['name' => 'Poland', 'native' => 'Polska', 'gl' => 'pl', 'hl' => 'pl'], 'GB' => [..., 'gl' => 'uk'], …]
GET/PUT /api/admin/assistant/settings  (role:admin) → { data: settings, sources: [{key, enabled, hasKey, cap, lastRun}] }
```
**Tests:** normalise defaults (the 13-country default), unknown ISO dropped, caps bounded, `hasKey` false without env, PUT validation.
Commit `feat(api): crawler settings and the countries table`.

### Task 3: `Source` contract, `CapLedger`, `CrawlSourceJob`

**Interfaces:**
```php
interface Source { public function key(): string; public function enabled(CrawlerSettings $s): bool; /** @return iterable<Query> */ public function queries(array $settings): iterable; /** @return Finding[] */ public function fetch(Query $q): array; }
final readonly class Query { public function __construct(public string $text, public ?string $country = null, public array $params = []) {} }
final readonly class Finding { public function __construct(public string $kind, public string $externalKey, public string $url, public string $title, public string $snippet, public ?string $country, public ?string $leadType, public array $payload) {} }
final class CapLedger { public static function remaining(string $source, string $period = 'day'): int; public static function take(string $source, int $n = 1): bool; }   // counts assistant_runs.queries per Warsaw date / month against settings caps
final class CrawlSourceJob implements ShouldQueue { public function __construct(public string $sourceKey) {} public int $tries = 2; public int $timeout = 300; middleware WithoutOverlapping($sourceKey) }
```
Upsert by `(source, external_key)`; status untouched on update; run row with `queries/found/new/status/error`.
**Tests:** `CrawlRunTest` with a `FakeSource`: new rows inserted, re-run upserts without touching `dismissed`, a throwing `fetch` ⇒ run `failed` + error text + job does not retry past `tries`, cap reached ⇒ `capped` and later queries skipped; `CapLedgerTest`: remainder across two runs on one day, month cap.
Commit `feat(api): the crawler source contract, cap ledger and run job`.

### Task 4: `google_cse` source

`GET https://www.googleapis.com/customsearch/v1?key&cx&q&gl&hl&num=10`; queries from settings: each keyword quoted (mentions), `ska news` per country (news), `ska concert|festival <country name>` and `site:instagram.com ska <city>` (leads, `lead_type` guessed from host: instagram/facebook ⇒ `profile`, else `null` for triage). `external_key` = sha1 of the normalised URL; `country` = the query's.
**Tests:** fixture JSON ⇒ findings; 429 ⇒ `capped`; missing key ⇒ disabled; `gl` uses the countries table (`GB` ⇒ `uk`).
Commit `feat(api): crawl Google Programmable Search for mentions, news and leads`.

### Task 5: `youtube` source

`search.list` (`q`, `type=video`, `regionCode`, `order=date`, `maxResults=25`) with the existing key; keyword queries ⇒ `mention`; `ska live <country>` ⇒ `lead` (`lead_type: band`, `payload.channelId`). 20 searches/day.
**Tests:** fixture; quota error (403 `quotaExceeded`) ⇒ `capped`.
Commit `feat(api): crawl YouTube for band mentions and live ska channels`.

### Task 6: Scheduler and commands

`routes/console.php`: `Schedule::command('assistant:crawl')->dailyAt(settings run_at)->timezone('Europe/Warsaw')->withoutOverlapping()`, `assistant:triage` +40 min, `assistant:digest` Mondays 08:00; commands `assistant:crawl [--source=]` (dispatches jobs), `assistant:triage`, `assistant:digest [--preview]` (Slice 4 fills the last two). `supervisord.conf` gains `[program:scheduler] command=php /var/www/html/artisan schedule:work --no-interaction`, `user=www-data`, priority 40.
**Tests:** `ScheduleTest` asserts the three events exist with the timezone and overlap lock; `assistant:crawl --source=google_cse` dispatches exactly one job (`Queue::fake`).
Commit `feat(api): schedule the assistant crawl, triage and digest`.

### Task 7: Findings endpoints + inbox + settings page (admin)

**API:** `GET /api/admin/assistant/findings?kind&country&status&q&page` (paginated, `with counts by country`), `PATCH /api/admin/assistant/findings/{id}` (`status: dismissed|new`), `GET /api/admin/assistant/runs` (last run per source). Role admin.
**Admin:** route `admin-assistant` (`adminUrl('assistant')`) + `admin-assistant-settings`; nav entry under *More* (admin only); `AssistantInboxView.vue` (thin) → `FindingsFilters.vue` (tabs + country chips with counts), `FindingRow.vue` (title, snippet, source badge, flag, score, summary, Open, Dismiss), `RunStatusBar.vue`; `AssistantSettingsView.vue` → `CrawlerSettingsForm.vue`. `src/api/assistantFindings.ts`, `useAssistantFindings`, `useCrawlerSettings`; `src/utils/findingsFilters.ts` (+spec: country counts, tab counts) and `crawlerSettings.ts` (+spec: normalise before PUT).
**E2E:** `assistant-inbox.spec.ts` (seed 3 findings via a test-only `POST /api/admin/assistant/findings` guarded by `app()->environment('local','testing')` **or** by factories through an `e2e:seed-findings` artisan command, like `SeedE2eTicket`; list, filter by country, dismiss; purge in `afterAll`), `assistant-settings.spec.ts` (add a country, toggle a source, save, restore).
Commit `feat(admin): the assistant inbox and crawler settings pages`.

**PR 1 gate:** backend suite, admin build + vitest, the two new specs + dashboard/admin-shell specs, `/code-review`.

---

## Slice 2 — the remaining sources, run status, manual run

### Task 8: `setlistfm` sibling bands
Settings gain `sibling_bands[{mbid,name}]` picked through a `SiblingBandPicker.vue` using the existing `SetlistFmController::searchArtist`; source: `GET /artist/{mbid}/setlists` pages 1–2, last 2 years ⇒ one `lead` per distinct venue (`external_key` = venue id, `lead_type: venue`, `country` from `venue.city.country.code`, payload: city, lastPlayed, bandName). 40 requests/day.
**Tests:** fixture ⇒ distinct venues; a venue the band already has (by name) still arrives (dedupe is triage's job — Slice 3).

### Task 9: `places`
`POST https://places.googleapis.com/v1/places:searchText` with `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.types,places.websiteUri`; one query per configured city (`live music venue in <city>`, `ska bar <city>`), one page, 30/day + 900/month; ⇒ `lead/venue`, `external_key` = place id, payload address/website.
**Tests:** fixture; field mask asserted; month cap.

### Task 10: `rss`
Each `rss_feeds[]` URL through `SafeUrl::get()`; parse RSS 2.0 / Atom with a small parser (no new dependency unless one is already present); items from the last 14 days ⇒ `news`, `external_key` = guid or link.
**Tests:** RSS + Atom fixtures; a private-IP feed URL rejected by `SafeUrl` ⇒ run `failed` with a clear error.

### Task 11: `meta_own`
`GET /{page-id}/tagged?fields=id,message,permalink_url,from,created_time` and `GET /{ig-user-id}/tags?fields=id,caption,permalink,username,timestamp` with the page token ⇒ `mention`. Disabled without `FACEBOOK_PAGE_ACCESS_TOKEN`.
**Tests:** fixtures; expired token (190) ⇒ run `failed` with "token expired — mint a new one" and the settings page shows it.

### Task 12: `reddit`
OAuth client-credentials (`https://www.reddit.com/api/v1/access_token`, `grant_type=client_credentials`), then `GET https://oauth.reddit.com/r/ska+reggae+punk/search?q&restrict_sr=1&sort=new&t=week` with a `web:bandms:v1 (by /u/<name>)` User-Agent; disabled without the two keys; off by default in settings.
**Tests:** token then search fixtures; 403 ⇒ `failed` with the IP-block hint.

### Task 13: Run status + manual run
`POST /api/admin/assistant/run` (admin, throttle 2/min) dispatches the crawl; `RunStatusBar` shows per-source last run (ok/capped/failed + error), remaining day budget, a **Run now** button; a source failed 3 nights running shows a banner.
**E2E:** run now ⇒ the bar updates (dev queue is `sync`).

Commit per task; **PR 2 gate** as PR 1.

---

## Slice 3 — triage, dedupe, Save as…, dashboard widget

### Task 14: `TriageFindingsJob`
Batches of 20 untriaged; `TextModel::structured($system, $user, SCHEMA, config('assistant.triage_model'))` with `SCHEMA` = `{ items: [{ id, relevant, kind, lead_type?, country?, score, summary, reason, contacts?: {email?, website?, instagram?, facebook?} }] }`; system carries the band profile paragraph (`band_profiles`: name, genre, base country, languages) and the summary language (`ContentLocales::primary()` name); before the call: `already_known` tag when `similar_text(name, existing) ≥ 85` against `venues/bands/authors` names, URL host+path dedupe across findings. Writes `triage`, `score`, `country`, `lead_type`, `triaged_at`.
**Tests:** fake model returns the schema ⇒ fields written; `relevant:false` ⇒ score 0; `already_known` skips the model; a malformed answer ⇒ job fails without touching rows.

### Task 15: Save as…
`POST /api/admin/assistant/findings/{id}/save` `{ as: venue|band|author, payload }` → creates through the existing controllers' validation (`VenueController@store` etc. via internal form requests), sets `saved_type/saved_id`, `status: saved`, `source: assistant:<id>` on the created row; `VenueQuickAdd`/`AuthorQuickAdd` gain `initial?: Partial<Payload>`; new `BandQuickAdd.vue` (kind select); `SaveAsMenu.vue` on the row maps `lead_type` → default table (spec table) and prefills from `triage.contacts`.
**E2E:** Save as Venue creates the venue (then deleted in `afterAll`) and the row shows *Saved*; a duplicate name shows the 422 inline, finding stays `new` (Review Focus 4).

### Task 16: Dashboard widget
`AssistantWidget.vue` on `AdminDashboard` ("N new leads · M mentions · last run …", link to the inbox); `GET /api/admin/assistant/summary`.
**E2E:** `dashboard.spec.ts` extended: the widget renders counts.

**PR 3 gate** as PR 1.

---

## Slice 4 — digest

### Task 17: `AssistantDigest` Mailable + `assistant:digest`
Query: findings `status new` and `score ≥ 50` since the last digest (`site_settings.assistant_last_digest_at`); top 10 leads grouped by country, all mentions, top 5 news; nothing to say ⇒ no mail (Review Focus 5); recipients `settings.digest_to` (default `ADMIN_EMAIL`); `--preview` prints the rendered HTML to stdout; Blade view `mail.assistant.digest` following `mail.newsletter.confirmation`.
**Tests:** `DigestTest`: renders groups, respects the score floor, sends nothing when empty, stamps `last_digest_at`, `Mail::fake()` recipients.
Commit `feat(api): the assistant's Monday digest`.

### Task 18: Docs
CLAUDE.md section (sources are declared, never scraped; caps per Warsaw day; adding a source = one class + settings row; the scheduler now exists — and `schedule:work` runs only in the container), `app/CLAUDE.md` (inbox/settings pages), CHANGELOG, `docs/deployment.md` (the new keys and the Google/Meta/Reddit setup clicks).

## Self-review notes

- Spec coverage: data → T1; settings/countries → T2; contract/caps/job → T3; sources → T4,5,8–12; schedule+supervisord → T6; inbox/settings/API → T7; run status/manual → T13; triage/dedupe → T14; save-as mapping + new columns → T1+T15; widget → T16; digest → T17; docs → T18. Anti-goals (no Meta scraping, no page bodies, capped bills, loud failures) land in Global Constraints and T3/T11/T13 tests.
- Review Focus pins: 1→T3; 2→T4+T3; 3→T3 `CapLedgerTest`; 4→T15 E2E; 5→T17.
- Dependencies: Slice 3 needs phase 2 merged (`TextModel::structured()`); Slices 1–2 do not.
