# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
- Accent colour switched from hardcoded orange (`#E2702A`) to a CSS custom property (`--color-accent`, now teal `#1f8f7a`). All components reference the variable — future rebranding requires a single-line change in `style.css`.

### Security
- `POST /door-check` now requires a valid Bearer token (`auth:api` middleware); previously it was publicly accessible and returned customer name and order UUID for any guessed ticket code.

### Fixed
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
