# Themeable public site — design spec

**Date:** 2026-08-27
**Status:** awaiting review
**Branch:** `feature/themeable-public-site`

---

## 1. Why

Two goals, in priority order.

1. **Now:** ship the Skanking Storks public site against the design in the
   Claude Design project `ec416ba8-dc11-4b7a-9648-25503de57abb`, starting with
   Contact.
2. **Later:** turn this repo into a generic CMS that other bands can use.

Those pull in opposite directions unless the styling is separated from the
markup. Today it is not: `web/src/` hardcodes one band's visual decisions at
~491 call sites, so a second band could only be served by forking the
templates.

This spec introduces a **base / theme split**:

| Layer | Owns | Changes per band |
|---|---|---|
| Base layout | Information architecture — what sections exist, in what order | No |
| Base look | A deliberately plain black-and-white skin | No |
| Theme | Colour, type, shape, elevation, ornament | Yes |

Skanking Storks' 2-Tone design becomes the first theme. The base is what a new
band sees on day one before theming.

---

## 2. Current state

Measured on `web/src` at `a2b775c` (63 `.astro`/`.vue` files):

```
Already semantic — themeable today                      ~210 uses
  bg-surface 54 · border-border 74 · text-accent 55 · bg-accent 27

Hardcoded — must be converted                           ~491 uses
  text-zinc-*        206     (500/400/600 = 70% of all raw palette use)
  text-white          93
  rounded-*          105     shape, not colour
  other palette       87     red/green/amber, bg-zinc-900, border-zinc-700
  scoped <style>      12 files
```

`web/src/styles/global.css` already declares a Tailwind v4 `@theme` block with
`--color-accent`, `--color-surface`, `--color-border`. The semantic layer exists
— it was simply never applied consistently, and it is not overridable.

**`rounded-*` is the non-obvious half of the problem.** Teams tokenize colour,
forget shape, then find their theme cannot express a brutalist design because
105 call sites hardcode a border radius. The 2-Tone design needs radius `0`
everywhere except social buttons.

---

## 3. Architecture

### 3.1 Three token tiers

The failure mode to design against is markup referencing brand values. Three
tiers prevent it:

```
Primitive    --ss-ink, --ss-paper, --ss-teal
             Theme-private. Declared in a theme file, never referenced in markup.

Semantic     --color-bg, --color-text, --color-text-muted, --color-accent,
             --font-display, --radius-card, --shadow-card, --display-transform
             THE CONTRACT. All markup uses only these.

Utility      Tailwind maps semantic tokens → classes
             text-muted, bg-surface, rounded-card, shadow-card
```

A component can never know which theme is active. That is the invariant the
whole design rests on; a single `text-zinc-400` in a component breaks it.

### 3.2 The semantic contract

Initial token set. Base values are black-and-white; SS values come from
`variants/shared.jsx` and `Contact.html`'s saved `TWEAK_DEFAULTS`.

| Token | Utility | Base | Skanking Storks |
|---|---|---|---|
| `--color-bg` | `bg-page` | `#ffffff` | `#EFE7D6` (PAPER) |
| `--color-ink` | — | `#000000` | `#121212` (INK) |
| `--color-surface` | `bg-surface` | `#ffffff` | `#ffffff` |
| `--color-surface-2` | `bg-surface-2` | `#f4f4f4` | `#EFE7D6` |
| `--color-surface-inverse` | `bg-inverse` | `#000000` | `#121212` |
| `--color-text` | `text-body` | `#000000` | `#121212` |
| `--color-text-muted` | `text-muted` | `#555555` | `#7a7468` |
| `--color-text-subtle` | `text-subtle` | `#767676` | `#8a8475` |
| `--color-text-on-inverse` | `text-on-inverse` | `#ffffff` | `#EFE7D6` |
| `--color-accent` | `text/bg-accent` | `#000000` | `#1F8F7A` |
| `--color-accent-contrast` | `text-on-accent` | `#ffffff` | `#ffffff` |
| `--color-border` | `border-border` | `#000000` | `#121212` |
| `--color-danger` | `text/border-danger` | `#000000` | `#C23A2B` |
| `--color-danger-subtle` | `bg-danger-subtle` | `#f4f4f4` | `rgb(194 58 43 / .08)` |
| `--color-success` | `text/border-success` | `#000000` | `#1F8F7A` |
| `--color-success-subtle` | `bg-success-subtle` | `#f4f4f4` | `rgb(31 143 122 / .08)` |
| `--font-display` | `font-display` | `system-ui` | `Anton` |
| `--font-body` | `font-body` | `system-ui` | `Archivo` |
| `--display-weight` | — | `700` | `400` |
| `--display-tracking` | — | `0` | `0` |
| `--display-transform` | — | `none` | `uppercase` |
| `--display-leading` | — | `1.1` | `0.9` |
| `--radius-card` | `rounded-card` | `0` | `0` |
| `--radius-pill` | `rounded-pill` | `0` | `9999px` |
| `--border-width-card` | `border-card` | `1px` | `3px` |
| `--border-width-emphasis` | `border-emphasis` | `1px` | `4px` |
| `--shadow-card` | `shadow-card` | `none` | `6px 6px 0 var(--color-ink)` |
| `--shadow-card-accent` | `shadow-card-accent` | `none` | `6px 6px 0 var(--color-accent)` |
| `--shadow-emphasis` | `shadow-emphasis` | `none` | `10px 10px 0 var(--color-ink)` |
| `--checker-cell` | — | `0` | `32px` |
| `--grain-opacity` | — | `0` | `0.06` |

`--display-*` and `--checker-*` have no utility class because they are consumed
inside base components and theme slots, never applied ad hoc in markup.

**`--radius-card` is `0` in both** — the plain base is square, and so is 2-Tone.
It is tokenized anyway because a future band's theme will want rounding, and
retrofitting shape into 105 call sites a second time is the exact cost this
spec exists to avoid paying twice.

Tokens are added as the remaining pages are ported. The contract is expected to
grow; the tiering is what must not change.

### 3.3 Theme selection

`<html data-theme={theme}>`, with each theme file scoped:

```css
[data-theme="skanking-storks"] { --color-accent: #1F8F7A; /* … */ }
```

**Not** conditional CSS imports at build time. Astro is SSG, so a build-time
switch bakes exactly one theme per build. An attribute costs the same today and
keeps per-request theming possible when this becomes multi-band.

This is also the CMS seam. Later, `GET /api/site-config` returns a theme name
plus token overrides, and `BaseLayout` injects them as an inline `<style>` on
`:root`. No build change is needed to get there — which is the entire point of
choosing tokens over hardcoded values now.

Theme name resolution order:

1. `siteConfig.theme` from the API (field does not exist yet — reserved)
2. `PUBLIC_THEME` env var
3. `"base"`

Falls back to `base`, never to a specific band. A missing theme must yield the
plain black-and-white site, not a broken one.

### 3.4 Ornament slots

Tokens cannot express a checkerboard divider, because it is an *element the base
layout does not have*. Slots close that gap:

```astro
<ThemeSlot name="section-divider" variant="accent" />
```

Base renders nothing. A theme registry maps slot names to components:

```ts
// web/src/themes/skanking-storks/slots.ts
export const slots = {
  'section-divider': CheckerStrip,
  'hero-backdrop':   CheckerOverlay,
  'card-mark':       CheckerSquare,
}
```

Three slots cover the Contact design. **Slots take props, never children** —
a slot that accepts children is a component override in disguise, and component
overrides were explicitly rejected: every override is a fork that stops
receiving base improvements.

If a design needs something a slot cannot express, the correct move is to add
the element to the *base layout* (where every band gets it, unstyled) and let
tokens hide it — not to widen the slot mechanism.

### 3.5 File layout

```
web/src/
  styles/
    tokens.css                    semantic contract + base values
    base.css                      element defaults, reset, prose
    global.css                    @import tailwindcss + tokens + base + themes
  themes/
    registry.ts                   name → slot map
    base/slots.ts                 empty
    skanking-storks/
      theme.css                   [data-theme="…"] token overrides
      slots.ts
      CheckerStrip.astro
      CheckerOverlay.astro
      CheckerSquare.astro
  components/
    ThemeSlot.astro
    Icon.astro                    ~30 icons ported from shared.jsx
```

---

## 4. Scope of this PR

Per the sequencing decision: **foundation + shared chrome + Contact.**

### 4.1 Token migration

Convert all ~491 hardcoded utilities across `web/src` to semantic tokens.
Mapping:

| From | Count | To |
|---|---|---|
| `text-zinc-300`, `text-zinc-200` | 15 | `text-body` |
| `text-zinc-400`, `text-zinc-500` | 158 | `text-muted` |
| `text-zinc-600`, `text-zinc-700`, `text-zinc-800` | 58 | `text-subtle` |
| `text-white` | 93 | `text-body` *or* `text-on-inverse` — see below |
| `bg-zinc-900`, `bg-zinc-800` | 25 | `bg-surface-2` |
| `border-zinc-700`, `border-zinc-600` | 16 | `border-border` |
| `placeholder-zinc-600` | 5 | `placeholder-subtle` |
| `rounded-xl`, `rounded-lg`, `rounded-md`, `rounded-2xl` | ~95 | `rounded-card` |
| `rounded-full` | ~10 | `rounded-pill` |
| `text-red-400` / `bg-red-900` / `border-red-800` | 7 | `text-danger` / `bg-danger-subtle` / `border-danger` |
| `text-green-400` / `bg-green-900`, `bg-green-700` / `border-green-800` | 9 | `text-success` / `bg-success-subtle` / `border-success` |

**`text-white` is the one that cannot be mechanised.** 93 uses, and the correct
token depends on whether the element sits on light or dark ground — which
inverts between the current dark site and the 2-Tone theme. On the existing site
every `text-white` is on dark, so a blind replace with `text-on-inverse` looks
right today and turns a cream page's headings invisible tomorrow. Each is read
in context.

The numeric-palette rows *can* be mechanised, but only after confirming no
occurrence sits on inverted ground. The lint rule in §8 is what keeps the
migration from silently regressing afterwards.

The 12 scoped `<style>` blocks are converted to reference `var(--color-*)`.

### 4.2 Shared chrome

Ported from `variants/shared.jsx`:

- **`Header.astro`** — ink bar, Anton brand at 22px, uppercase Archivo nav
  (`700 14px/1`, tracking `.08em`), active item in accent, `LangToggle`, cart
  circle.
  **Constraint:** the design hardcodes its nav array. Ours must keep the
  existing `siteConfig.module_order` + `slugMap` logic in `Header.astro:19-31`
  untouched. The design supplies the nav's *look*, never its *contents* —
  hardcoding it would reintroduce the disabled-module dead-link footgun
  documented in CLAUDE.md.
- **`Footer.astro`** — ink, checker strip pinned to top, `1.3fr 1fr 1fr` grid
  (brand + socials / booking / nav), bottom bar at `600 13px/1`.
- **`Icon.astro`** — the ~30-icon set, `viewBox="0 0 24 24"`, `strokeWidth 1.7`,
  round caps/joins.
- **`CheckerStrip.astro`** + a `checkerBg()` helper mirroring the
  `repeating-conic-gradient` from `shared.jsx`.
- **`LangToggle`** — reuse the existing `LanguageSelector.astro`, restyled.

Every other public page inherits the new shell and tokens in this PR while
keeping its current body layout until its own PR.

### 4.3 Contact page

Rebuilt in `web/src/components/sections/ContactSection.astro`, with
`web/src/pages/contact/index.astro` delegating to it (both entry points already
exist and are currently duplicated verbatim — this PR removes that duplication).

Rendered at the design's saved tweak state: accent `#1F8F7A`, Anton/Archivo,
`checkerCell: 32`, grain on, rider and FAQ shown.

Sections, in order:

1. **Hero** — ink ground, checker overlay at 5% white. Kicker `800 14px/1`
   tracking `.34em` in accent; `h1` Anton 140px/0.82; lead `500 20px/1.55` at
   82% opacity, max-width 680. Two buttons (scroll-to-form, open calendar),
   then two pills (reply time, hometown).
2. **Checker divider** — `h 16`, cell 21, accent on paper.
3. **Form + direct contacts** — `1.5fr 1fr`, gap 48.
   - Form card: 4px border, `10px 10px 0` ink shadow, ink header bar with a
     checker square. Reason picker, name/email pair, subject, message, error
     row, footer with reply note and submit.
   - Sidebar: three ink contact cards with `6px 6px 0` accent shadow, then a
     socials card with 44px circular bordered icons.
4. **Checker divider** — `h 14`, cell 20, ink on paper.
5. **Promoters & press** — heading Anton 56px/0.96, four cards (Book us, EPK,
   Tech rider, Press photos) at `6px 6px 0` ink shadow. Rider card toggles an
   inline preview inside a 4px dashed border.
6. **Checker divider** — `h 14`, cell 20, accent on paper.
7. **FAQ** — accordion, 3px ink rules, 34px square toggle that fills with accent
   when open. First item open by default.

Interactive parts become Vue islands (`client:visible`): `ContactForm.vue`,
`FaqAccordion.vue`, `AvailabilityModal.vue`, `EpkModal.vue`. Static structure
stays in Astro.

Exhaustive per-element values live in `variants/contact_page.jsx` in the design
project; this spec does not transcribe them.

### 4.4 Backend

| Feature | Change |
|---|---|
| Contact form | Post `reason` + `website` honeypot. **Fixes a live bug** — see §6.1 |
| FAQ | New `faqs` table: translatable `question`/`answer`, `sort_order`, `is_published`. Model, public `GET /api/faqs`, Passport-guarded CRUD, admin editor |
| Contact module config | `kicker`, `lead`, `reply_time_label`, per-channel notes — translatable, on the existing `website_modules` row |
| Availability | New range endpoint — see §6.2 |
| EPK modal | Asset list assembled from existing `getEpk()` data |

---

## 5. Data mapping

| Design element | Source |
|---|---|
| Hero title | Module label (`module_config.contact.label`) |
| Hero kicker / lead / reply badge | New contact module config |
| "Based in Warszawa, PL" | `profile.hometown` |
| Booking / press / general emails | `profile.booking_email`, `press_email`, `contact_email` |
| Per-channel notes | New contact module config |
| Socials | `getSocialLinks()` |
| Reason picker values | Already accepted by `ContactController` |
| Book us → calendar | New range endpoint over `BandCalendarController` |
| EPK card + modal | `getEpk()` |
| Tech rider preview | `GET /api/tech-riders/active`, rendered by existing `PublicRider.vue` |
| Press photos | Photos module, gated on `modules.photos !== false` |
| FAQ | New `faqs` table |

**Every outbound link is gated on the module map, not on data presence** —
`modules.<slug> !== false`, never `=== true`. `getSiteConfig` fails open to `{}`
when the API is unreachable mid-build, so an absent key must mean *enabled*.
This is the exact footgun CLAUDE.md documents; the promo cards are four new
chances to reintroduce it.

---

## 6. Bugs found while specifying

### 6.1 The public contact form has never worked

`ContactController::store` requires `reason` (`api/app/Http/Controllers/ContactController.php:20`).
`web/src/components/ContactForm.vue:16` posts only `{name, email, subject, message}`.
Every submission from the public site returns 422.

The dead SPA form at `app/src/views/ContactView.vue:46` sends it correctly —
the Astro form was never updated when `reason` was added.

Nothing in the repo catches this: the contract between a `fetch` body literal
and a Laravel `validate()` array is enforced by no type system. Fixed here, and
covered by an E2E test that actually submits.

### 6.2 The availability endpoint leaks member movements

`GET /api/band-profile/calendar/availability?date=…` is public, unauthenticated,
and returns `busy_members` with each member's full name and role
(`BandCalendarController.php:60-72`). Anyone can enumerate which musician is
busy on which day.

It is also single-date, so a month grid would need 30 requests, each parsing
remote iCal feeds.

New endpoint `GET /api/band-profile/calendar/availability-range?start=&end=`:

- returns `{ date, status }` per day, `status ∈ open | held | booked`
- **no member names, roles or counts**
- factors in confirmed concerts alongside iCal busy days
- caps the range at 92 days
- caches per month

The single-date endpoint is left in place but has `busy_members` removed. That
is a breaking change for any consumer relying on it; a repo-wide grep shows
none.

---

## 7. Testing

- **Backend (Pest):** FAQ CRUD + validation + translation clearing; range
  endpoint bounds, status derivation, and a regression test asserting no member
  names appear in the response; contact form accepts the payload the Astro form
  actually sends.
- **Frontend:** `pnpm build` (runs `vue-tsc`) in both `app/` and `web/`.
- **E2E:** submit the contact form end-to-end and assert the success state.
  This is the test class that would have caught §6.1.
- **Build verification:** resolve every href in `dist/` for the contact page and
  confirm both directions of the module gate — with each linked module on and
  off. Per CLAUDE.md, an inverted gate looks entirely plausible when tested only
  one way.
- **Visual:** compare against `screenshots/` in the design project.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| 491-site token migration is mechanical but wide; a missed `text-zinc-*` silently breaks theming | Lint rule failing the build on raw palette utilities in `web/src` |
| `text-white` (93 uses) needs per-site judgement | Reviewed individually, not sed-replaced |
| Astro build is all-or-nothing — one throw kills all 35 pages | Guard every field read from the API; run the real build before shipping |
| Other pages get new chrome but old body layout | Accepted and explicit; chrome is theme-driven so they stay coherent |
| Base theme is never exercised, rots | `PUBLIC_THEME=base` build in CI |

---

## 9. Out of scope

- Porting the other eight designed pages — one PR each, after this.
- EPK `.zip` generation. The design's "Download full EPK (.zip)" links to the
  existing EPK page. Zip building is its own feature and is not smuggled in.
- The tweaks panel. It is a design tool.
- The four-font-set switcher — a tweaks affordance, not a site feature. Anton /
  Archivo only.
- CMS-driven theming. The token layer is designed for it; the admin UI is not
  built.
- The `app/` SPA. Its public views are unreachable in production (Caddy routes
  only the `@spa` allowlist there). Untouched, and not deleted in this PR.

---

## 10. Open questions

None blocking. Assumptions, all overridable on review:

1. Accent is teal `#1F8F7A` — Contact.html's saved state — not brand orange
   `#E2702A`.
2. `showRider` / `showFaq` become real module config rather than hardcoded
   booleans.
3. The legacy unlocalised `/contact` route keeps working, delegating to the same
   section component as `/[lang]/[section]`.
