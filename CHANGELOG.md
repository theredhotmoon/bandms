# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **The public site is themeable.** Its look is split into a deliberately plain black-and-white base and a theme that overrides colour, type, shape, elevation and ornament. The band's 2-Tone design ships as the first theme; a second band can be served by adding a stylesheet rather than forking templates. Which theme renders is an attribute on the page, so it can be driven from the CMS later without a rebuild.
- **The whole public site is redesigned.** Contact, Music, Gallery, About, the article view, the release detail page and the site footer now carry the 2-Tone design, and Videos, Press, EPK and Newsletter were restyled to match it.
- **Contact page.** A booking form with a reason picker, direct contact cards, promoter and press links, and an FAQ. Its hero copy, reply-time badge and per-channel notes are editable per language.
- **Availability calendar.** Promoters can browse open, on-hold and booked dates month by month and pick one; the date pre-fills the booking form rather than sending an anonymous enquiry nobody can answer.
- **Press kit modal.** Lists what the band actually has — bio, press photos, logo, streaming stats, tech rider, stage plot — with each row appearing only when its file or page exists.
- **Music page.** Featured release with tracklist, an expandable discography, a "where to listen" band, the music-video gallery with a lightbox, published lyrics, and physical formats tied to a release.
- **Gallery page.** Album cards with photo counts and a press-ready badge, a category filter, and a full lightbox with keyboard control. The press-ready flag has been in the CMS for a long time with nothing showing it.
- **About page, now a website module.** It was an English-only page, absent from the nav and impossible to rename, reorder or switch off. It now has a Polish URL (`/pl/o-nas`) and behaves like every other section.
- **FAQ entries, grouped by subpage.** Questions are assigned to a page in `/admin/faqs` and appear in an FAQ block at the bottom of it. A page with no questions shows no block.
- **Editable page copy per module.** `/admin/website-modules` gained a Page copy panel, so hero lines, badges and captions are edited in the admin instead of in code.
- **The footer is a configurable module.** Its tagline, column headings, booking blurb and rights line are editable per language, and it can be switched off entirely.
- **Press coverage on articles.** A story's coverage now appears as a pull quote in the body and an "In the press" list, each entry naming the publication.
- **Contact is a configurable website module.** It used to be hardcoded into the public site — always rendered, always in the nav, its label and per-locale slug fixed in `web/src`. It now appears in `/admin/website-modules` alongside every other section and can be switched off, renamed per locale, and dragged into any nav position. Disabling it removes the nav link, the footer link, the homepage "Book us" call-to-action, the `/rider` fallback link, and both the localised and legacy `/contact` pages, leaving no dead links behind.
- **Every website module has its own URL slug, per language.** New EN and PL slug fields in the module editor, each showing the path it produces (`/en/shop`) and validated for URL safety and uniqueness. Leaving a slug empty serves the module under its key, so `videos` stays at `/en/videos` however it is labelled.

### Changed
- **Music videos appear on the Music page as well as their own page.** Both read the same source, so nothing is duplicated; a band that wants videos only on Music can switch the standalone module off.
- **Renaming a module no longer moves its page.** Public slugs were previously derived from the module's label on every build, so changing "Shop" to "Merch store" silently moved `/en/shop` to `/en/merch-store` and broke every link anyone had saved. Label and URL are now independent: the label controls nav text only, and the URL changes when — and only when — the slug field is edited. Existing slugs were carried over unchanged, so no live URL moved on upgrade.
- **A slug is only cleared when explicitly set to null.** Sending one locale's slug leaves the other untouched, so a partial update cannot silently move the Polish page.

### Fixed
- **The public contact form never worked.** It posted four fields to an endpoint that requires a fifth, so every message sent from the website was rejected. Nothing surfaced it: the form reported the failure as a generic error.
- **The public availability endpoint exposed band members' movements.** It needed no login and returned each musician's full name and role for any date, so anyone could work out who was busy when. It now reports only whether the band is free.
- **Switching a module off left its page online.** The page was correctly dropped from the build, but the published site kept the previous copy, so a section could be disabled and still be served — with stale content — until the container was recreated.
- **A second dialog on the same page did nothing.** Opening the press kit after the availability calendar left an inert button with no visible cause.
- **Several styles silently did nothing.** Seven hover states and one background referenced colours that no longer existed, so they never applied. The build now fails on that rather than shipping it.
- **Member instruments, album locations and press links never appeared** on the public site, despite being filled in, because the site's own type definitions omitted the fields the API was sending.
- **The homepage no longer links to pages that a disabled module never builds.** Its hero buttons and its Upcoming shows / Music / News sections were gated on whether *content* existed rather than on whether the module was enabled — the two agree until content exists while its module is switched off. With Releases disabled but releases still in the database, the homepage advertised `/en/releases` and every individual release, all of them 404s.

## [0.7.1] - 2026-08-20

### Fixed
- **Corrected the E2E triage guidance in `README.md`, `CLAUDE.md` and the tech-rider spec.** 0.7.0 documented a ~2 GB free-RAM floor below which the Playwright suite was said to fail regardless of the code. A run on `64254a1` with 176 MB reported free passed 178/178 in 2.4 minutes, disproving it: `FreePhysicalMemory` counts only unused pages, not reclaimable ones, so a low reading does not mean memory is unavailable. Triage now keys on the failure *signature* — `Zone Allocation failed`, `GPU process launch failed`, a different failing set each run, or 30-second timeouts instead of assertion mismatches — with free RAM as a weak hint at most. The docs no longer justify skipping an E2E run on a low memory reading alone.

## [0.7.0] - 2026-08-20

### Added
- **Published tech rider versions** — a rider can now be *published*, which freezes it as an immutable version and points its public link at that frozen copy. New `tech_rider_versions` table, `POST /api/tech-riders/{id}/versions` to publish, `GET /api/tech-riders/{id}/versions` to list, `DELETE /api/tech-rider-versions/{id}` to remove an archived one. Publishing archives the previous version, and every version keeps its own permalink — so re-sending a corrected rider never breaks the link a venue already has. A "Publish v*n*" button and a version-history modal live in the tech rider editor topbar; unsaved editor changes are saved as part of publishing. Publishing is blocked outright while the rider has no named channels — a blank input sheet is not a document worth sending — while every other gap (unplaced musicians, a musician with no inputs or monitor) is named in the confirm dialog and can be published past.
- **Rider snapshots freeze the resolver's inputs, not its output** (`App\Services\TechRiderSnapshotBuilder`) — a version stores the rider, the saved rigs its placements reference, the musicians it places, and the band logo, rather than a flattened channel list. `app/src/utils/riderResolver.ts` stays the only implementation of the derivation rules; a PHP copy would be a second one, free to drift. Snapshots carry display identity only and never the admin-only band-member fields.
- **Frontend unit tests (Vitest)** — 57 tests covering the three pure modules the tech rider stands on: `riderResolver` (the single derivation point every surface calls), `riderDiff` (what a venue is told changed), and `rigValidation` (the rule that blocks a save). 100% statement, line and function coverage on all three; sub-second, no Docker and no browser. `pnpm test:unit` / `make test-unit`, and the first stage in `scripts/test-all.sh`, ahead of the backend suite and E2E — it needs neither Docker nor a browser, so it fails fastest.
- **Version diff for tech riders** — the version history can compare any version with the one published before it: "+2 channels · 1 monitor changed". Both snapshots are resolved with the same `riderResolver` that renders them and matched by resolved row key, so a row that changed is reported as a change rather than as an unrelated removal and addition. New `GET /api/tech-rider-versions/{id}` serves one snapshot at a time.
- **Duplicate a rider** — `POST /api/tech-riders/{id}/duplicate` and a copy button in the rider sidebar. A festival rider is usually a club rider plus a few channels; the copy carries the stage plot and the production extras, and none of the identity — its own public token, inactive, no versions, and no concert link.
- **Create a rider from a concert** — a "Rider" button on each row of the Concerts admin. Names the rider after the venue and date, links the concert, and pre-fills tonight's lineup from the current members, so the user lands on the one thing that cannot be inferred: the stage plot. Returns 409 if the concert already has a rider.
- **Ask the band to confirm their rigs** — one button emails everyone in tonight's lineup who can sign in, pointing at My Setups; their answer is timestamped against the rider. The rider editor shows who has confirmed and who is still waiting, and My Setups shows a banner for any rider waiting on you. Answers the question completeness cannot: not "is this rig filled in" but "has the person who plays it looked at it recently". New `tech_rider_confirmations` table; confirming is scoped to the caller, never to a member id.
- **Social link ordering** — drag handles on each row of the `SocialLinksEditor` let admins reorder social links; the custom order is persisted to the database (new `position` column on `social_links`) and reflected on the public site after a rebuild.
- **Website Module Management** — admin panel at `/admin/website-modules` to enable or disable each of the 10 public website sections (Concerts, Releases, News, Photos, Press, Videos, Shop, EPK, Tech Rider, Newsletter). Disabled modules are removed from the public site's navigation and their pages redirect to 404. Changes take effect after a rebuild.
- **Public site hot-swap rebuild** — a Node.js webhook server inside the `web` container listens on port 3001 (Docker-internal only). Admins can trigger a full Astro SSG rebuild from the admin panel without restarting the container; a progress bar shows real-time build status (building / done / error) with elapsed time and a 5-minute timeout guard.
- **Auto-rebuild on module changes** — a toggle in the admin panel enables automatic rebuild whenever a module's enabled state is changed.
- **`GET /api/site-config`** — public endpoint returning the enabled/disabled state of all modules; used by the Astro build to gate pages and nav links at build time (fail-open: missing config treats all modules as enabled).
- **`assertSafeSlug`** utility in `app/src/api/client.ts` — validates slug strings before URL interpolation, consistent with the existing `assertSafeId` guard.
- **`SocialLinksEditor` — reusable social links component** — single Vue 3 component (`SocialLinksEditor.vue`) for managing social media links across all entities. Supports all 9 platforms (Spotify, Instagram, Facebook, YouTube, TikTok, Bandcamp, SoundCloud, Twitter/X, Website) with coloured platform indicators. Replaces the per-link CRUD UI in Band Profile (now bulk-save), the inline platform rows in Band Member form, and adds social link support to Authors & Contacts and Venues for the first time.
- **Concert ticket platform** — full ticketing system for concerts: ticket types with sale windows, multi-tier pricing (Early Bird, Regular, VIP), per-order quantity limits, venue capacity checks, and QR-code door scanning. Integrated into the shared checkout alongside merch.
- **Concert slugs** — concerts now have bilingual URL slugs (`slug_en`, `slug_pl`) used by the Astro public site's concert detail pages (`/concerts/[slug]`).
- **Door check admin view** — `/admin/door-check` lets staff scan a ticket code and mark it as scanned in one step.
- **Promo codes for tickets** — promo codes can now be scoped to a specific ticket type in addition to order-wide discounts.
- **Ticket admin panel** — `ConcertTicketsManager` component in the concert admin form lets staff manage ticket types and price tiers inline.
- **Bilingual slug input** (`SlugInput.vue`) — reusable admin form component that auto-generates EN/PL URL slugs from a source field, with manual override and regeneration buttons.
- **Public site redesigns** — `web/` concerts index (Leaflet map + year archive filter), concert detail page (venue map, ticket availability), posts index (news filter), and homepage all redesigned with the Astro 5 island architecture.
- **Astro public site** (`web/`) — a fully static (SSG) public-facing website built with Astro 5, replacing the Vue SPA's public pages. Served by Nginx; built at container startup so the Astro build can reach the backend over Docker networking.
- 20 public pages: home, concerts (index + detail), releases (index + detail), posts (index + detail), EPK, merch (index + detail), photo gallery, music videos, press, contact, newsletter, and token-action pages (newsletter confirm/unsubscribe, public tech rider).
- 9 Vue islands with hydration directives (`client:visible`, `client:idle`, `client:load`): `MobileNav`, `CartIcon`, `CartDrawer`, `ContactForm`, `NewsletterSignup`, `PhotoLightbox`, `AddToCart`, `TokenAction`, `PublicRider`.
- JSON-LD structured data on key pages: `MusicGroup` (home), `MusicEvent` (concert detail), `MusicAlbum` (release detail), `Article` (post detail).
- Cross-island cart state via nanostores (`cartItems`, `cartOpen`, `cartCount`), persisted to `localStorage`.
- `@astrojs/sitemap` integration — generates `sitemap.xml` at build time.
- Caddy routing updated: `/api/*` and `/storage/*` → backend; `/admin*` and `/login` → Vue SPA; all other traffic → Astro public site.
- `make web-dev` and `make web-build` targets; `make logs-web` for the new container.
- `contact_email` field on `BandProfile` — admins can set a general-purpose contact address in the band profile editor; the Contact page uses it as the "General" email with a fallback to `hello@skankingstorks.com`.

### Changed
- **The public rider link now serves a published version, not the live rider** — `GET /api/public/rider/{token}` returns `{ rider, members, profile, version }` instead of the bare rider, and returns **404 until the rider has been published at least once**. A promoter holding the link keeps seeing the sheet they were sent even after a musician edits their saved rig. The token printed on QR codes follows the band forward to whichever version is currently published; each version's own token stays pinned to that version forever. `RiderPublicView` reads everything from the snapshot, so the page went from three requests to one.
- **Tech riders are the single source of truth for their own technical data** (merged in #20, previously undocumented here) — placements reference a `band_member_setups` row plus a sparse per-gig override, and the printed lists (channels, monitors, backline, power, RF) are derived at render time rather than stored. Removed the four "Build from stage plot" banners, the "Import from members" panel, and the `inputs`/`monitors`/`backline`/`power`/`rf_wireless` columns they wrote to.
- Accent colour switched from hardcoded orange (`#E2702A`) to a CSS custom property (`--color-accent`, now teal `#1f8f7a`). All components reference the variable — future rebranding requires a single-line change in `style.css`.
- **Playwright worker count pinned to 2 locally** (was 4). Each worker costs a Chromium instance and a share of the Vite dev server's heap, so halving them halves the peak footprint — enough to stop the dev server dying with `Zone Allocation failed - process out of memory` on a machine short of RAM. It reduces the flakiness rather than curing it: the underlying cause is free memory, not worker count, and below a couple of GB free the suite still loses specs. Override per run with `pnpm test:e2e --workers=4`.

### Fixed
- **Newsletter confirm and unsubscribe links no longer return a server error when their pages are absent** — both blocks had the same nginx `try_files` defect fixed for `/rider/`: the shell page sat in the fallback position, so a missing page caused an internal redirect loop and a 500 rather than a 404. All three token routes now use `$uri/index.html` (never `$uri/`, which triggers a browser-cached 301) with a `=404` terminator.
- **A public rider link returns a clean 404 instead of a server error when the page was never built** — with the tech-rider module disabled, `/rider/{token}` hit an nginx `try_files` whose last parameter was an internal redirect back into the same block, looping until nginx gave up with a 500. A promoter following a stale link now gets a proper not-found page rather than an error.
- **The public site container no longer crash-loops after a local `pnpm` run** — pnpm 10+ writes an `allowBuilds`-only `pnpm-workspace.yaml` into `web/`, and the pnpm@9 pinned in the web image reads any such file as a workspace declaration and refuses to build without a `packages:` field. The stub is now ignored by git and kept out of the Docker build context, so a stray local file can no longer be baked into the image.
- **Adding a blank channel row no longer fails with an unexplained "Failed to save"** — `+ Add row` in any rig editor creates a channel with no instrument name, which `inputs.*.instrument` requires, so the next save was rejected with a generic toast and no indication of which of five tabs held the offending row. The row is now marked where it is created (red border, `aria-invalid`, a count in the table footer), and the save is refused locally with a message naming the row and section. Applies to the tech rider's extra channels, a placement's per-gig override, and a member's saved rigs in both the admin panel and self-service My Setups.
- **Save failures now say what the server rejected** — new `saveErrorMessage()` helper in `app/src/api/client.ts` unwraps `ApiValidationError` to the first field message and its path instead of discarding it. Used by the rig save paths; publishing a rider now aborts if the save it performs first is refused, rather than freezing the last saved state.
- **Public site nav links redirect to wrong port after rebuild** — clicking `/concerts` (or any nav link) from the dev server on port 4322 no longer redirects to `http://localhost/concerts/` (port 80, the Vue SPA). Root cause: Nginx's `try_files $uri $uri/` issues a `301 Permanent` redirect whose `Location` is built from `$host` — stripping the port. Browsers then cache the broken redirect forever. Fixed by switching to `try_files $uri $uri/index.html $uri.html =404`; the SSG index file is now served directly with no redirect at all. Added `absolute_redirect off` as defence-in-depth and documented the footgun in `CLAUDE.md`.
- **Astro Docker build** — pinned pnpm to v9 in the `web/` Dockerfile (pnpm v10 dropped `package.json` `pnpm` field support, blocking `esbuild`/`sharp` post-install scripts); stripped CRLF from `start.sh` so the Linux shebang resolves on Windows-built images; added `web/.gitattributes` to enforce LF line endings for `*.sh` going forward.
- **Astro public pages** — guarded all API array properties with `?? []` before `.length`/`.map()` calls; the Laravel API returns `null` (not `[]`) for empty relationship arrays. Affected: EPK, release detail, post detail, concert detail, merch detail, photos index.
- Admin releases: creating a release no longer fails when the track list contains an untitled entry; empty tracks are silently filtered before the payload is sent to the API.
- Admin concerts: editing an existing concert now correctly trims time fields (doors open, sound check, start time) to HH:MM, preventing the seconds component from leaking into the inputs.
- Admin delete dialogs: `ConfirmDialog` now correctly exposes `role="dialog"` and `aria-modal` for assistive technology.
- Admin Band Profile: section-switcher buttons now carry `role="tab"` and `aria-selected`, matching ARIA authoring practices for tab widgets.
- Admin sidebars: page titles in Band Members, Tech Rider, Setlists, and Users are now proper `<h1>` elements instead of styled `<div>` elements.
- Admin setlists: inline delete confirmation card now has `role="dialog"` and `aria-modal`.
- Tests: fixed a concurrency bug in the Playwright E2E suite where the Logout tests revoked the shared Passport token mid-run, causing up to 38 parallel tests to receive 401 responses and redirect to `/login`. Logout tests now mock the backend endpoint so only frontend behaviour (localStorage cleared, redirect) is verified. All 174 admin E2E tests now pass in parallel.

### Security
- `POST /door-check` now requires a valid Bearer token (`auth:api` middleware); previously it was publicly accessible and returned customer name and order UUID for any guessed ticket code.

## [0.6.0] - 2026-06-15

### Added
- EN/PL i18n across all public views.
- Contact form with honeypot spam protection and `/api/contact` backend endpoint.
- Redesigned Contact page with direct-email cards, promoter resources, and FAQ accordion.

## [0.5.0] - 2026-05-01

### Added
- Public merch store with Stripe Checkout and shopping cart.

## [0.4.0] - 2026-04-01

### Added
- Newsletter double opt-in with spam protection.
