# Changelog

All notable changes to BandMS are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
