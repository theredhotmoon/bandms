# Changelog

All notable changes to BandMS are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## Next Steps

Ideas and features planned for future development:

### Music Discovery & Playlist Promotion
- **Spotify playlist research** — investigate playlist pitching workflows: editorial playlist submission via Spotify for Artists, third-party playlist pitching platforms (SubmitHub, Groover, Playlist Push, Daily Playlists), and curated playlist discovery via API. Goal: surface playlists that match the band's genre tags and comparable artists, and allow tracking pitch status per playlist.
- **YouTube & other platform playlists** — similar research for YouTube Music, Apple Music, Deezer, Tidal, and SoundCloud. Identify which platforms expose playlist curator contact data via API or third-party services.
- **"Similar bands" playlists** — use comparable artists (already in band profile) to discover playlists that already feature those artists and pitch to the same curators.
- **Playlist pitch tracker** — a new admin section to track outreach: platform, playlist name, curator contact, date pitched, response status, and notes.

---

## [Unreleased] — 2026-06-09

### Added
- **Public rider page at `/rider/:token`** — mobile-friendly, print-ready public page (no login required) served via a stable token URL. Displays stage plot, musician configuration, input list, monitor summary, wireless registry, backline, PA/FOH, and power requirements. Includes a concert date/venue in the cover and toolbar when a concert is linked.
- **QR code per placed stage member** — each musician card on the stage plot canvas now has a QR button that opens a modal with a scannable QR code. The code links to the rider's public `/rider/:token` URL so venue crew can access the full rider from any phone.
- **Concert picker in tech rider admin** — a compact select in the stage tab links a rider template to a specific concert. Saved automatically on change. The linked concert date and venue appear on the public rider page.
- **Default setup toggle in member setups panel** — each setup in the sidebar now shows a ★ star when it is the default setup. The star button on non-default setups promotes that setup to default (clearing the previous one). A `is_default` field is now returned in the setup summary API response.

### Fixed
- **500 on public rider endpoint** — `GET /api/public/rider/:token` returned 500 when a rider had no concert linked (`concert_id = null`). The `TechRiderResource` callback now guards against a null relation before accessing `concert->id`.

---

## [Unreleased] — 2026-06-03

### Added
- **Main instrument per band member** — each member now has a single `main_instrument_id` that drives their icon on stage plots and in the tech rider. Set it in the Band Members admin form via the new radio-style instrument card selector.
- **`stage_plot_type` on instruments** — every instrument can now be mapped to a visual icon type (`drums`, `guitar_amp`, `bassist`, `vocalist`, `keyboard`, etc.). Configurable in the Instruments admin with an emoji preview picker.
- **Shared monitor between instrument setups** — when a member plays multiple instruments, their per-instrument setup can now reference another setup's monitor mix instead of duplicating it. Configured in the Monitor tab of each setup editor.
- **Auto-populate stage plot on drop** — dragging a member to the stage canvas now automatically adds a `PlacedInstrument` from their main instrument (correct icon type + label pre-filled).
- **Instrument icon in stage plot member panel** — the "Drag to place" panel now shows each member's main instrument emoji next to their name.
- **Instrument name in setup sidebar** — the setup list in the member setups panel shows the associated instrument name under each setup entry.
- **Playwright E2E test suite** — 179 tests across 20 admin panel spec files covering auth, dashboard, all CRUD sections, validation, modal/toast behaviour. Config in `app/e2e/`, run with `pnpm test:e2e`.
- **`/ship` skill** — global Claude Code skill (`~/.claude/skills/ship.skill`) that runs the full shipping pipeline: optionally rebuild Docker containers, run all tests, fix failures, update CHANGELOG, create a branch, commit, push, and open a PR.
- **`scripts/ship.sh`** — standalone shell script for the same pipeline, usable without Claude. See `bash scripts/ship.sh --help`.
- **`scripts/test-all.sh`** — runs backend unit tests + E2E tests, with `--skip-unit` / `--skip-e2e` flags.
- **`make ship` / `make test-all`** — Makefile shortcuts for the above scripts.

### Changed
- **Band member form** — instruments section split into "Main instrument" (single selector with emoji) and "Also plays" (multi-select checkboxes). Selecting a main instrument auto-adds it to the "also plays" list.
- **Instrument setup editor** — shows instrument context tag (emoji + name) at the top; Monitor tab has explicit "Own monitor mix" / "Share with…" options.
- **README** — full rewrite covering stack, quick start, all `make` commands, rebuild modes, testing (unit + E2E), shipping pipeline, project structure, env vars, and logs reference.

### Fixed
- `auth.setup.ts` used `__dirname` (CommonJS) in an ES module project — Playwright failed to discover any tests. Fixed with `fileURLToPath(import.meta.url)`.
- `scripts/ship.sh` summary showed duplicate step entries due to pre-populated `STEP_NAMES[]` array conflicting with `begin_step()`. Fixed step tracking.
- `--dry-run` incorrectly skipped the CHANGELOG update. Fixed to only skip git operations.
- `test-all.sh` summary showed `✅` for skipped suites. Fixed to `⚠️ (skipped)`.

## [Unreleased] — 2026-06-04

### Added
- **Band logo system** — upload, version, and manage multiple logo variants. Each logo carries variant (full/icon/horizontal/stacked/wordmark), background (light/dark/transparent/any), label, version history label, and notes.
- **`is_default` global default** — exactly one logo can be the global default; enforced transactionally. First upload auto-becomes default.
- **`is_deprecated` flag** — mark old logo versions as deprecated. They are excluded from public API responses and context-pin dropdowns but remain in the admin for history.
- **Context-specific logo pins** — `band_profiles` gains `epk_logo_id`, `tech_rider_logo_id`, `website_logo_id`. Each context falls back to the global default when not pinned.
- **Auto-detect SVG vs raster** — mime type stored on upload; width/height populated for raster, null for SVG; `is_vector` boolean surfaced in API.
- **`BandLogoManager` admin component** — drag-and-drop upload with per-file metadata form, logo grid with badges (DEFAULT, SVG, DEPRECATED), inline edit, inline delete confirm, context pins section with per-context selects and Save button.
- **Logo tab in Band Profile admin** — new "Logo" section tab alongside Bio, Career, Social, Contacts, Stats, EPK.
- **Logo in Tech Rider preview** — cover page and toolbar both show the logo (tech_rider_logo_id pin if set, else global default).
- **Logo in EPK page** — band logo shown above band name in the EPK header.
- **Logo in public navbar** — `AppNavbar` shows the band logo image (website_logo_id pin or global default) instead of the static "BandMS" text when a logo is available.
- New API routes: `GET/POST /api/band-profile/logos`, `PUT/DELETE /api/band-profile/logos/{logo}`, `POST /api/band-profile/logos/{logo}/set-default`.
- `logo_url` added to `GET /api/band-profile` and `GET /api/band-profile/epk` responses.
