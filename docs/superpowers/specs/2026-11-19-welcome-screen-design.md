# Welcome screen and friendlier cookie consent — design

Date: 2026-11-19 · Branch: `feature/welcome-screen`

## Intent

Google Analytics is live, and the cookie banner is a thin strip at the foot of
the page. The band wants a first visit to do more than that:

1. **More newsletter sign-ups.**
2. **Put upcoming gigs in front of first-time visitors.**
3. **More visitors choosing "Allow"**, so GA sees a larger share of traffic.

Goal 3 is pursued by persuasion, not pressure: an honest, human reason to
allow analytics, with two equal buttons. Pressure (a smaller or greyer Reject,
extra clicks to reject, content held back until Accept) is what EU regulators
fine, so it is an anti-goal.

## Goals

- A **two-step first visit**:
  1. **Consent card** (only when GA is configured): a centred card over a
     dimmed page, the band's pitch for analytics, **Allow** and **No thanks**
     of equal size and weight, policy link.
  2. **Welcome screen** (its own switch, independent of GA): a full-page
     overlay with up to four blocks and an "Enter the site" button.
- Every block, its order, and every string configurable in the admin, in
  every locale.
- How often it appears: every N days, or once per visitor — plus a *Show to
  everyone now* button that makes it appear once more to everyone.
- Optional geographic targeting: promote only gigs within a configurable
  radius of the visitor, located by IP on our own server.

## Non-goals

- Detecting newsletter subscribers to suppress the welcome (explicitly
  deferred by the band).
- Cookie-free analytics (Umami/Plausible). Mentioned as the better answer to
  goal 3; a separate project if ever wanted.
- Changing what GA does, or the consent store's semantics (6-month expiry,
  footer "Cookie settings" link reopening step 1).

## Anti-goals

- Any asymmetry between Allow and No thanks: size, colour weight, position,
  number of clicks.
- The welcome screen appearing, or behaving differently, depending on the
  consent answer. It opens after **either** answer.
- Interrupting a visitor who arrived with a purpose (see *Where it never
  shows*).
- A welcome screen that renders a hole: an enabled block with nothing to show
  (no upcoming gigs, no posts, `concerts`/`news` module off) is omitted, and
  if every block is omitted, the screen does not open at all.

## Approaches considered

### Locating the visitor

| | Approach | Trade-off |
|---|---|---|
| **A** | **IP → city via MaxMind GeoLite2 on our own server** | **Picked by the band.** No prompt, IP never leaves our server, city accuracy is enough for ~100 km. Needs a free licence key and a scheduled database update |
| B | Browser geolocation prompt | Accurate, but a permission prompt on first visit is the pressure the design avoids; most people block it |
| C | Third-party IP lookup API | No setup, but every visitor's IP goes to an outside company |

### The screens

| | Approach | Trade-off |
|---|---|---|
| A | One full-page screen: consent buttons pinned at the bottom, promo blocks above | One click, but the promo sits inside the consent dialog (pressure concerns) and Google treats a promotional full-screen interstitial as intrusive on mobile |
| **B** | **Two steps: clean consent card, then full-page welcome** | **Picked by the band.** Consent stays clean so the honest pitch can work; the welcome reaches people who said no as well. Costs one extra click |
| C | Light consent card; promo as a non-blocking slide-in or homepage blocks | Least intrusive, weakest push for gigs and sign-ups |

## Behaviour

### Step 1 — consent card

- Rendered only when `PUBLIC_GA_MEASUREMENT_ID` is set (unchanged).
- Shown when `consentStatus === 'unknown'` (unchanged rule; 6-month expiry and
  the footer's Cookie settings link keep working as they do).
- Centred card, page dimmed behind it, focus trapped in the card. Esc does
  **not** dismiss it — dismissing without an answer would leave the status
  `unknown` and bring the card back on the next page, which is worse than
  asking once.
- Copy: existing `bannerBody` (re-defaulted to a friendlier, honest pitch,
  e.g. *"We're an independent band. Analytics tell us which cities our
  visitors come from, which helps us decide where to play next. Nothing loads
  unless you allow it."*), `bannerAccept` (default → "Allow"), `bannerReject`
  (default → "No thanks"), `bannerLink`. A new `bannerTitle` heading.
  Existing overrides stored under these keys keep winning.
- Both buttons share one style class; only the label differs. (My call: the
  E2E asserts equal bounding-box size.)

### Step 2 — welcome screen

Opens when **all** of these hold:

- the `welcome` module row is enabled;
- the current path is not excluded (below);
- no fan is signed in in this browser (`fan_token` in `localStorage`);
- the visitor is due to see it (see *How often* below);
- at least one enabled block has content **for this visitor** (after the
  geographic rule, below);
- and, when GA is configured, consent is no longer `unknown` (so it follows
  step 1 in the same page load, or opens straight away for a returning
  visitor who already answered).

Visitors who answered the cookie banner before this ships therefore see the
welcome once. That is intended — it is the gig push.

### How often

`localStorage['bandms:welcome']` holds `{ seenAt: ISO, campaign: number }`.
The admin picks a **frequency**:

- **`interval`** — shown again once `reshow_days` have passed since `seenAt`.
- **`once`** — shown once per visitor, and not again until the band presses
  *Show to everyone now*.

Independently of the frequency, the admin has a **Show to everyone now**
button. It stamps a new `campaign` number (a Unix timestamp) in the
settings; a visitor whose stored `campaign` differs from the baked one is
due, whatever their `seenAt`. So each press makes the screen appear once
more to every visitor — including those who saw it yesterday. The button
marks the site dirty like any save; the new campaign reaches visitors with
the rebuild (immediate when auto-rebuild is on; the admin says so next to
the button otherwise).

A visitor with no stored value is always due (first visit).

`seenAt` is written when the screen **opens**, not when it is closed — a
visitor who navigates away via a gig link has seen it. Storing that flag is
functional storage (remembering a dismissed dialog), so it needs no consent.
Storage failures fail closed: no storage → do not show (a visitor in private
mode must not get it on every page).

Closes on "Enter the site", ✕, Esc, or a click on the backdrop. Focus trapped
while open; focus returns to the page on close; `role="dialog"`,
`aria-modal="true"`, labelled by its heading.

**Blocks** (each toggleable, order configurable):

| Block | Content | Hidden when |
|---|---|---|
| `concerts` | next 1, 2 or 3 upcoming shows (date, city/venue), each linking to its show page | none upcoming, or `concerts` module off |
| `news` | the latest published post (title, date, image if any), linking to it | no posts, or `news`/posts module off |
| `newsletter` | the existing `NewsletterSignup` form (double opt-in unchanged), copy via props | `newsletter` module off *(my call: same gate as the other blocks — no sign-ups for a list the band switched off)* |
| `account` | an email field that requests the fan magic link (`POST /api/fan/auth/magic-link`, the comments' flow), with the current path as `return_to` | — |

The account block follows the same `fan_return_to` rule as `PostComments`
(store the requested return path so `/account` honours it only in this
browser) — reuse the helpers in `web/src/lib/comments.ts`, do not duplicate
them.

### Near a gig — geographic targeting

Optional, switched in the admin (`geo.enabled`, default **off**). When on,
the gigs block shows only **upcoming shows whose venue is within
`geo.radius_km`** (default 100, bounds 10–1000) of the visitor, still capped
at `concert_count`.

What a visitor far from every gig gets is the admin's choice
(`geo.far_visitors`):

- **`hide_gigs`** (default) — the welcome without the gigs block; news,
  newsletter and account as configured. If that leaves no block, no screen.
- **`no_screen`** — no welcome at all; the screen is a local gig push only.

**How the visitor is located (approach A, picked by the band):** our own
backend looks up the request IP in **MaxMind GeoLite2-City**, a free
city-level database held on our server. No browser prompt, no third party
sees the IP, nothing is stored.

- Endpoint `GET /api/welcome/nearby` (public, `throttle:30,1`) returns
  `{ "located": bool, "concert_ids": [ids of upcoming concerts within the
  radius] }`. Radius from `WelcomeSettings`; venue coordinates from
  `venues.latitude/longitude` (haversine in PHP — a handful of rows, no
  spatial index needed). Concerts whose venue has no coordinates never count
  as near. The visitor's coordinates are **not** returned.
- PHP side: `geoip2/geoip2` reader over
  `storage/app/geoip/GeoLite2-City.mmdb`, behind one small interface
  (`App\Support\Geo\Locator`) so tests bind a fake. The IP must be the real
  client's: `bootstrap/app.php` already has `trustProxies(at: '*')`, so
  `request()->ip()` reads Caddy's `X-Forwarded-For`; the builder still
  confirms on the dev stack that it is not Caddy's container address.
- The database is fetched by `php artisan geoip:update` with
  `MAXMIND_LICENSE_KEY` (added to the backend `environment:` of **both**
  compose files, see CLAUDE.md), scheduled weekly in `withSchedule()`. The
  `.mmdb` lives on the backend's storage volume so it survives redeploys;
  the command also runs once from the entrypoint when the file is missing
  and a key is set.
- **Fail open** *(my call)*: no key, no database, a private/unknown IP or a
  lookup error → `located: false`, and the island behaves as if targeting
  were off (shows the next gigs). A broken geo setup must not silently hide
  the gig push from everyone. The admin panel shows whether a geo database
  is installed (`GET /api/admin/welcome-settings` carries `geo_available`),
  and the radius controls say "inactive — no location database" when it is
  not.
- The island calls the endpoint only when `geo.enabled` and only when the
  screen is otherwise due — never on every page view.
- Privacy policy: one new copy field on the Privacy row
  (`locationHeading`/`locationBody`) saying the IP is used, transiently and
  on our own server, to estimate the visitor's city in order to show nearby
  shows, and is not stored. Rendered only when `geo.enabled`.
- The IP must not reach the logs: the endpoint does not log it, and the
  activity log already ignores anonymous requests.

The baked island receives **all** upcoming concerts (capped at 50, with id,
date, venue, city, URL) when targeting is on, so it can pick the nearby
ones; otherwise just `concert_count` of them.

### Where it never shows On these paths the welcome never opens, **and step 1
renders as today's non-blocking bottom strip** instead of the modal card, with
the same copy and the same equal buttons *(my call: a modal over the privacy
policy would block the very page its link points to, and a venue opening a
rider should not be stopped)*. The card and the strip are two layouts of one
component, chosen by the same path rule:

- `/rider/*` — venues opening a tech rider
- `/{lang}/privacy` — someone reading the policy
- `/account*` — fans returning from a sign-in link
- `/newsletter/*` — confirm / unsubscribe pages
- `/tickets/*` — ticket claim links

These are matched client-side on `location.pathname`; the list lives in one
exported constant beside the "should it show" rule.

## Configuration — admin

A new copy-only `website_modules` row, slug **`welcome`**, display name
*Welcome screen* (PL *Ekran powitalny*), sort order 93 beside the other fixed
rows. Added to `NON_PAGE_MODULES` (no URL slug, hero, FAQ category); **not**
in `ALWAYS_ON_MODULES` — its `enabled` toggle is the master switch.

- **Copy**: `packages/site-copy/src/modules/welcome.ts` (`WELCOME_COPY`), the
  usual registry: heading, intro, each block's title, newsletter/account
  labels and messages, "Enter the site", close label. Edited in the existing
  page-copy form like every other module.
- **Structured options**: one JSON row in `site_settings`,
  `App\Support\WelcomeSettings` (pattern: `CommentSettings`), normalised on
  every read.
- **The row is created disabled** *(my call)*: the deploy changes nothing
  visible until the band has reviewed the copy and switched it on in the
  admin. The consent card does ship live on deploy (it replaces the strip).
  E2E: a shared fixture pre-seeds `bandms:consent` and `bandms:welcome` in
  `localStorage` for existing public specs, so neither modal blocks them; only
  the welcome/consent specs start from an empty storage.
- Structured options:

  ```json
  { "blocks": ["concerts", "news", "newsletter", "account"],
    "concert_count": 2,
    "frequency": "interval",
    "reshow_days": 90,
    "campaign": 0,
    "geo": { "enabled": false, "radius_km": 100, "far_visitors": "hide_gigs" } }
  ```

  `blocks` is the ordered list of *enabled* blocks (absent = off). Bounds:
  `concert_count` 1–3, `reshow_days` 1–365, `radius_km` 10–1000;
  `frequency` ∈ `interval|once`; `far_visitors` ∈ `hide_gigs|no_screen`.
  Defaults as shown.
- Edited in a *Welcome screen* panel on the `welcome` row in
  `/admin/website-modules`: checkbox + drag order per block, gig count,
  frequency (radio: *every N days* / *once per visitor*), the *Show to
  everyone now* button (with the date of the last press), and a *Near a gig*
  fieldset (switch, radius in km, far-visitor choice, database status).
  Endpoints (auth, admin role): `GET`/`PUT /api/admin/welcome-settings`,
  `POST /api/admin/welcome-settings/campaign` (stamps a new campaign; the PUT
  never changes `campaign`, so an ordinary save cannot re-show the screen to
  everyone). Validation: Pest feature tests (happy path, auth, bounds,
  unknown block, campaign stamping).
- Served to the build in `GET /api/site-config` as a top-level `welcome`
  object (beside `hero_images`, **not** inside `module_config` — see the
  hero-images note in CLAUDE.md about `slugs.ts` iterating
  `module_config`).
- Saving calls `SiteRebuild::markDirty('website-modules')` — the options are
  baked.

## Public build

- `BaseLayout.astro` mounts a `WelcomeScreen.vue` island (`client:idle`,
  Teleport gated on mount per CLAUDE.md) when the `welcome` module is
  enabled and at least one block has data. Gig and news data come from the
  build (`getConcerts(lang)` filtered to upcoming, sliced to
  `concert_count`; the latest post from `getPosts(lang)`), shaped into plain
  props — island props are JSON.
- The consent card and welcome coordinate through `stores/consent.ts`
  (existing atom); the welcome island watches it. No new store unless the
  builder finds it needed.
- "Should it show now" is a pure function in `web/src/lib/welcome.ts`
  (path, stored `seenAt`, now, interval, fan signed in, consent status, GA
  configured) with Vitest coverage.
- All styling through tokens (`check-tokens.mjs`).

## Tests

- **Vitest** (`web/src/lib/welcome.test.ts`): show rule — every exclusion,
  interval expiry, `once` mode, a new campaign re-arming a visitor who saw
  it, fan signed in, consent unknown with/without GA, storage unavailable;
  block selection — near gigs only, `hide_gigs` vs `no_screen`, `located:
  false` falls back to the next gigs.
- **Pest**: `WelcomeSettings` normalisation; endpoint auth/validation;
  campaign endpoint stamps and PUT never does; `site-config` carries
  `welcome`; save marks `website-modules` dirty; `/api/welcome/nearby` with a
  fake `Locator` — inside/outside radius, past concerts excluded, venue
  without coordinates excluded, locator failure → `located: false`;
  `geoip:update` without a key exits cleanly. Nothing in CI downloads from
  MaxMind.
- **E2E public** also covers targeting via `page.route` on
  `/api/welcome/nearby` (near → gigs block; far + `hide_gigs` → no gigs
  block; far + `no_screen` → no screen).
- **Vitest (`packages/site-copy`)**: registry keys/defaults present in en+pl.
- **E2E admin** (`e2e/tests/admin/welcome-screen.spec.ts`): toggle blocks,
  reorder, set count/days, save, reload persists; restores the original row
  in `afterAll`.
- **E2E public** (`e2e/tests/public/welcome-screen.spec.ts`): first visit
  shows consent then welcome; equal button sizes; welcome opens after
  *No thanks* too; closes and does not reopen on the next page; excluded
  paths never show it; signed-in fan never sees it. Must tolerate GA unset
  in the test env (step 2 alone). Existing `consent-banner.spec.ts` updated
  for the card.

## Left to the builder

- Visual layout of the card and welcome screen within the theme tokens
  (follow `frontend-design` guidance and existing section styles).
- Exact default copy wording (en + pl).
- Whether the welcome's news block reuses an existing card component.
- Animation (keep it short and respect `prefers-reduced-motion`).
