# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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

### Fixed
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
