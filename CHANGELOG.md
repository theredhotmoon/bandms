# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `contact_email` field on `BandProfile` — admins can set a general-purpose contact address in the band profile editor; the Contact page uses it as the "General" email with a fallback to `hello@skankingstorks.com`.

### Changed
- Accent colour switched from hardcoded orange (`#E2702A`) to a CSS custom property (`--color-accent`, now teal `#1f8f7a`). All components reference the variable — future rebranding requires a single-line change in `style.css`.

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
