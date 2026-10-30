# Admin assistant, phase 3 — the crawler

**Date:** 2026-10-30 · **Status:** draft, awaiting approval · **Umbrella:** `2026-10-29-admin-assistant-design.md` · **Depends on:** phase 2 shipped — its `TextModel::structured()` is what triage calls, and `ANTHROPIC_API_KEY` is already plumbed. Slices 1–2 need no model at all and may start as soon as phase 2's interface is merged.

## Intent and why

Ska is a worldwide scene with a small, well-connected audience: the clubs,
promoters, festivals and bands that book or share ska in Hamburg, Osaka or
Mexico City are findable, but finding them by hand is evenings of searching.
The band wants a "robot" that looks every night for (a) anything about
*Skanking Storks*, (b) ska news and (c) new people to reach — venues,
promoters, festivals, bands, media, profiles — **anywhere in the world**,
grouped by country, and lands all of it in one admin inbox plus a Monday
email. Nothing is contacted or published automatically; the robot finds and
triages, a person decides.

## Goals, non-goals, anti-goals

**Goals**

1. A nightly run that gathers *findings* from a declared set of sources into
   one table, deduplicated, each with a kind (mention / news / lead), a
   country, a score and a short triage summary.
2. An admin inbox (`/admin/assistant`) to read, dismiss, or **save a lead as a
   Venue, Band or Author** with its details pre-filled — the existing tables,
   not a parallel CRM.
3. A Monday digest email of the week's best findings, grouped by kind and
   country, linking into the inbox.
4. A settings page: keywords, countries, source toggles, digest recipients.
5. Costs that stay inside free quotas by default: per-source query budgets,
   and a visible counter.

**Non-goals**

- Sending outreach. Drafting one (phase 2's model, "like us") is a later
  button on a saved lead, not part of this phase.
- Real-time alerts. Nightly is the cadence; the digest is weekly.
- Sentiment analysis, follower counts, "influence" scores.
- A general web crawler. Every source is a named API or feed.

**Anti-goals**

- **Scraping Facebook or Instagram.** Meta withdrew group and public-page
  content from its API in 2023; every tool that still offers it scrapes in
  breach of Meta's terms and risks the band's own page. Only the band's **own**
  page/account mentions and tags go through the Graph API. Public IG/FB
  *profiles* reach the inbox only as URLs returned by Google — the index is
  the source, the page is never fetched.
- **Storing other people's content.** A finding holds a URL, a title, a short
  snippet (≤ 500 chars) and the source's own id. Never a full page or post.
- **A nightly bill surprise.** Each source has a hard query cap **per
  calendar day** (and per month where the provider's free tier is monthly);
  an admin-triggered run spends only what the day has left. The run stops a
  source at its cap and says so in the inbox header. Google's Places API
  requires a billing account on the project even for its free allotment —
  the band attaches a card with a **budget alert at €5** or leaves Places off
  (open question 1).
- **Silent failure.** A source that errored three nights running is a banner
  in the inbox, not a quiet absence (the `web` crash-loop lesson).

## Constraints

- No scheduler exists: `schedule:work` is added to `api/docker/supervisord.conf`
  beside `queue:work`. Jobs are queued (`database` in prod) with `tries: 2`,
  `timeout: 300`, and a `WithoutOverlapping` lock per source.
- Keys via env → `config/services.php` → both compose files:
  `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` (Programmable Search; Places uses the same
  key with the Places API enabled), the existing `YOUTUBE_API_KEY`,
  `SETLISTFM_API_KEY`, the new `FACEBOOK_PAGE_ACCESS_TOKEN` + `FACEBOOK_PAGE_ID`
  + `INSTAGRAM_USER_ID` (the page id is read by code today but is in neither
  compose file), optional `REDDIT_CLIENT_ID/SECRET`, plus `ANTHROPIC_API_KEY`
  from phase 2. A missing key disables that source (reported in settings),
  never errors.
- Outbound fetches of **feeds** go through `App\Support\SafeUrl::get()` (SSRF
  guard); API calls go through `Http::` with timeouts like the existing
  controllers.
- Settings live in `site_settings` as one JSON key `assistant_crawler`
  (`App\Support\CrawlerSettings` normalises it) — the first real settings page;
  keys stay in env.
- CI calls nothing: every source is tested against `Http::fake()` fixtures;
  triage against the fake `TextModel`.

## Data

```
assistant_findings
  id, kind ENUM(mention,news,lead), source VARCHAR(40), external_key VARCHAR(255)   -- unique(source, external_key)
  url TEXT, title VARCHAR(500), snippet VARCHAR(500), language VARCHAR(8)?,
  country CHAR(2)?            -- ISO 3166-1, from the source or triage
  lead_type ENUM(venue,promoter,festival,band,media,profile)?           -- leads only
  score TINYINT (0–100)        -- triage relevance; 0 until triaged
  status ENUM(new,saved,dismissed) DEFAULT new
  triage JSON?                -- { relevant, summary, reason, contacts: {email?, website?, instagram?, facebook?} }
  saved_type VARCHAR(20)?, saved_id BIGINT?    -- venue|band|author it became
  payload JSON               -- the source's raw record, trimmed
  found_at, triaged_at?, created_at, updated_at

assistant_runs
  id, started_at, finished_at?, source, status ENUM(ok,capped,failed), queries INT, found INT, new INT, error TEXT?
```

`external_key` is the source's stable id (a video id, a place id, a result
URL hash) so a nightly re-run upserts rather than duplicates. A finding
dismissed once never comes back as `new` (upsert keeps `status`).

## Sources (initial set — every one official or feed-based)

| Source | What it finds | Key | Cap (default) |
|---|---|---|---|
| `google_cse` — Programmable Search JSON API (engine set to "search the entire web"; `gl`/`hl` per country) | mentions of the band; ska news; leads via per-country queries (`ska concert <country>`, `ska festival 2027`, `site:instagram.com ska <city>`) | `GOOGLE_API_KEY`+`GOOGLE_CSE_ID` | 80 queries/**day** (free: 100/day, then $5/1 000 only if billing is on) |
| `youtube` — Data API v3 `search.list` (100 units a call) | band mentions, ska live videos per country (channel = a band/venue lead) | existing | 20 searches/day = 2 000 units, leaving the view-count sync its share of the 10 000/day quota |
| `setlistfm` — setlists of **sibling bands** the band picks in settings (artist search via the existing `SetlistFmController::searchArtist`; setlist.fm has no genre filter) | **warm venue leads**: where those bands played in the last 2 years, with `city.country.code` | existing | 40 requests/day |
| `places` — Google Places Text Search (New), field mask `id,displayName,formattedAddress,location,types,websiteUri` (Enterprise SKU: **1 000 free/month**) | venues: `live music club` / `ska bar` per configured city | `GOOGLE_API_KEY` (Places enabled, billing account) | 30/day **and 900/month**; one page per query |
| `meta_own` — Graph API `/{page-id}/tagged` and IG `/{ig-user-id}/tags` | posts tagging the band's own page/account | new **`FACEBOOK_PAGE_ACCESS_TOKEN`** (a long-lived Page token with `pages_read_user_content`, minted once by a page admin) + `FACEBOOK_PAGE_ID` and `INSTAGRAM_USER_ID` in both compose files | 5/day |
| `reddit` — OAuth "script" app search of r/ska, r/reggae, r/punk (**off by default**: unauthenticated `.json` is throttled and Hetzner's IP ranges are often blocked) | news, mentions | `REDDIT_CLIENT_ID/SECRET` + a `/u/name` User-Agent | 20/day |
| `rss` — configurable feed URLs (ska blogs, festival news) | news | none | 1 fetch per feed |

IG `mentioned_media` (caption/comment @mentions) is webhook-driven and needs
a public endpoint plus app review; it is **out**. `/tags` (photo tags) is
what can be polled.

Each source is a class implementing `App\Assistant\Crawler\Source`
(`key()`, `enabled(settings)`, `queries(settings): iterable`,
`fetch(query): Finding[]`); `CrawlSourceJob` runs one source under its cap
and writes an `assistant_runs` row. Adding a source is one class and one row
in the settings page's toggle list.

**Country division.** Settings hold `countries: [ISO…]` (default: PL, DE, CZ,
SK, LT, GB, NL, ES, IT, US, MX, JP, BR — the ska map — editable; ISO
3166-1, so `GB`, which the countries table maps to Google's `gl=uk`) and
`cities_by_country` for Places. Query templates expand per country using the
registry's `name` for the country list (a small `countries.php` table: ISO →
English name + native name + Google `gl`/`hl` codes). A finding's `country`
comes from the query that found it, the Places address, or triage.

## Triage (the one place AI is used)

`TriageFindingsJob` takes untriaged findings in batches of 20 and asks
`TextModel::structured()` for a JSON answer per item
(`output_config.format` json_schema): `{ relevant: bool, kind, lead_type?,
country?, score 0–100, summary ≤ 160 chars, reason, contacts?: {...} }`. The
summary is written in the band's **primary content language**
(`ContentLocales::primary()` — triage runs at night with no user, and the
digest goes to several people), stored as a plain string.
The prompt carries the band's one-paragraph profile (from `band_profiles`:
genre, base country, languages) so "relevant" means *to this band*. An item
the model marks `relevant: false` is stored with `score: 0` and hidden behind
a "show filtered" toggle, never deleted. Dedupe before the call: same URL
host+path, and a lead whose name is `similar_text ≥ 85 %` to an existing
Venue/Band/Author is tagged `already_known` and skipped.

Model: `ASSISTANT_TRIAGE_MODEL`, **default `claude-haiku-5-5`** (the band's
choice — classification with a schema is where the cheaper model is
enough); nightly volume is ~100 items × ~600 tokens ≈ 1.8M tokens a month,
under $1 there, ~$7 on `claude-opus-5-5`.

## Admin

- **Inbox `/admin/assistant`** (admin-only; nav group *More*): tabs
  *Leads · Mentions · News*; filters by country (chips with counts) and
  status; a row = title, snippet, source badge, country flag, score,
  summary, `Open ↗`, **Save as…**, **Dismiss**. Header: last run per source
  (ok / capped / failed with the error), "N new since the digest".

  **Save as… maps every `lead_type` onto the three existing tables** (my
  call; the band can overrule):

  | `lead_type` | becomes | pre-filled from `triage.contacts` |
  |---|---|---|
  | `venue` | **Venue** — `venues` gains `country CHAR(2)` and `website` (migration, `VenueForm`, resource, tests); a worldwide crawler cannot save a venue without the field it grouped by | name, city, country, website |
  | `promoter`, `festival`, `band` | **Band** (the table already holds "other bands and promoters") — `bands` gains `kind ENUM(band,promoter,festival)` and `country` | name, website, kind |
  | `media`, `profile` | **Author** (the press-contacts table; a person or an outlet — `first_name` takes the display name) | name, email, website→notes, instagram, facebook, country |

  All three gain `source VARCHAR(40)?` (`assistant:<finding id>`), the
  umbrella's "lead" marker, so a saved lead stays distinguishable from a
  contact the band typed. The quick-adds (`VenueQuickAdd`, `AuthorQuickAdd`,
  a new `BandQuickAdd`) take an `initial` prefill prop for this.
- **Settings `/admin/assistant/settings`:** keywords (band names, aliases),
  countries, cities per country, source toggles (a source without a key is
  shown off with "no key"), per-source caps, RSS feed list, digest recipients
  (default `ADMIN_EMAIL`), run time.
- **Dashboard widget** "Assistant: 12 new leads, 3 mentions" linking in.
- **Digest** `AssistantDigest` Mailable, Mondays 08:00 server time: top 10
  leads by score grouped by country, all mentions, top 5 news, with links;
  `assistant:digest --preview` prints it.

API: `GET /api/admin/assistant/findings?kind&country&status&page`,
`PATCH /api/admin/assistant/findings/{id}` (`status`, `saved_type/id`),
`GET/PUT /api/admin/assistant/settings`, `GET /api/admin/assistant/runs`,
`POST /api/admin/assistant/run` (admin-triggered run, same jobs).

## Schedule

`routes/console.php`: `assistant:crawl` nightly 03:00 (dispatches one
`CrawlSourceJob` per enabled source), `assistant:triage` 03:40,
`assistant:digest` Mondays 08:00 — all `->timezone('Europe/Warsaw')` (the
app runs in UTC) and `withoutOverlapping()`. Supervisord gains
`[program:scheduler] php artisan schedule:work`. Day caps are counted in
`assistant_runs` per source per Warsaw date.

## Tests

| Layer | What |
|---|---|
| Pest | one `*SourceTest` per source with `Http::fake()` fixtures: parses, **day cap counted across runs** (a manual run spends only the remainder; Places also monthly), missing key ⇒ disabled, errors ⇒ run `failed` not thrown; `CrawlRunTest` (upsert keeps `dismissed`, unique key); `TriageTest` with the fake model (schema honoured, `relevant:false` ⇒ score 0, dedupe/`already_known`, summary in the primary content locale); inbox endpoints (auth admin-only, filters, patch, save-as creates the right table with `source` set); `venues.country/website`, `bands.kind/country` through their forms' tests; settings normalise; digest renders and lists the right items; schedule registered with the Warsaw timezone |
| Vitest | `findingsFilters.spec.ts` (pure grouping/count logic), `crawlerSettings.spec.ts` |
| Playwright | `assistant-inbox.spec.ts` (seeded via API: list, filter by country, dismiss, Save as Venue creates the venue and marks the finding), `assistant-settings.spec.ts` (toggle a source, add a country, save; restored in `afterAll`) |

## Slices (one PR each)

1. Schema (findings, runs, the three `source` columns, `venues.country/website`,
   `bands.kind/country`) + `CrawlerSettings` + settings page + scheduler +
   `Source` contract + day-cap accounting + `google_cse` and `youtube`
   sources + inbox list (read/dismiss).
2. `setlistfm` (with the sibling-band picker), `places`, `rss`, `meta_own`,
   `reddit` sources + run status header + admin-triggered run.
3. Triage (`TextModel::structured()`) + dedupe + *Save as…* with the three
   prefilled quick-adds + dashboard widget.
4. Digest mail + preview command.

## Decisions from the band (2026-10-30)

1. **Google:** one Cloud project, Programmable Search JSON API + Places API
   (New), one key, one engine set to "search the entire web", **billing
   account attached with a €5 budget alert** — Places is on.
2. **Facebook/Instagram:** the band mints a long-lived Page access token
   (`pages_read_user_content`) and supplies the Page id and IG business id —
   `meta_own` is on.
3. **Reddit:** the band registers a "script" app — `reddit` is on once its
   two keys exist (still off by default in settings until then).
4. **Triage model: `claude-haiku-5-5`** — `ASSISTANT_TRIAGE_MODEL` defaults
   to it; Enhance keeps `claude-opus-5-5`.
5. Country list: the default above.

The exact clicks for 1–3 are in `docs/deployment.md` once slice 2 lands
(the builder writes them with the source).

## Left to the builder

- Exact query templates per source (iterate on real results).
- Row/filter styling in the inbox (follow the posts table).
- The countries table's shape (`ISO → {name, native, gl, hl}`).
