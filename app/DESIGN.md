---
name: BandMS Admin
description: The band's backstage console — a dark, exact, single-accent Operate surface with a mirrored light theme.
colors:
  # Every value below is the DARK theme. The light theme redefines the same
  # tokens under <html data-admin-theme="light"> in src/admin-palette.css;
  # components never see a hex, only var(--c-*). Keys here are the roles;
  # the token each role maps to is in parentheses in the prose.
  signal-teal: "#0f766e"
  signal-teal-bright: "#0b8276"
  page: "#0a0a0a"
  panel: "#111111"
  card: "#141414"
  hover: "#1a1a1a"
  selected: "#222222"
  hairline: "#262626"
  control-border: "#2a2a2a"
  control-border-strong: "#333333"
  ink: "#e2e8f0"
  ink-max: "#ffffff"
  ink-strong: "#d0d0d0"
  ink-body: "#c0c0c0"
  ink-secondary: "#94a3b8"
  ink-muted: "#8a96aa"
  ink-faint: "#979797"
  button-primary-bg: "#e8e8e8"
  ok: "#34d399"
  ok-ground: "#14532d"
  warn: "#fbbf24"
  warn-ground: "#1a1740"
  danger: "#f87171"
  danger-ground: "#2d1212"
  info: "#60a5fa"
  info-ground: "#1e3a5f"
typography:
  display:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  ui:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  xs: "0.25rem"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  pill: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.button-primary-bg}"
    textColor: "{colors.panel}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.ink-max}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
  button-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.sm}"
    padding: "0.3125rem 0.625rem"
  button-row-hover:
    backgroundColor: "{colors.control-border}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: "0.3125rem 0.625rem"
  button-rebuild:
    backgroundColor: "{colors.signal-teal}"
    textColor: "#ffffff"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
  button-rebuild-hover:
    backgroundColor: "{colors.signal-teal-bright}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5625rem 0.75rem"
  input-focus:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "1.25rem 1.5rem"
  table-card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.lg}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
  nav-item-active:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink-max}"
  badge:
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "0.15rem 0.5rem"
---

# Design System: BandMS Admin

## Overview

**Creative North Star: "The Backstage Console"**

The admin is the mixing desk behind the band's public site: a dark surface
where every control is readable at a glance, nothing glows unless it means
something, and the one coloured light on the desk is the *go* button. It is
sharp, technical and fast. The band is here between rehearsal and load-in to
add a show, publish a press kit or fix a slug, and the interface should
disappear into that task — scanability, consistency and native expectations
outrank expression. Brand lives in precise details: the hairline that divides a
stat strip, the tabular numerals in a date column, the caret that matches the
theme.

Density is high but never cramped: a 14px body on 1.4 leading, 13px controls,
11px uppercase labels, and nothing smaller than that anywhere. Depth is tonal,
not cast: page → panel → card → control step up in lightness, and a shadow
appears only when something actually floats (a modal, the phone drawer).
Colour is monochrome plus one teal; the status greens, ambers, reds and blues
are vocabulary for *state*, never decoration. The light theme is the same desk
under house lights — the same tokens, re-pointed — so a component that is
right in one theme is right in both, and a raw hex anywhere is a bug.

**Key Characteristics:**
- Monochrome surfaces with a single accent (Signal Teal) reserved for the rebuild action and the theme switch.
- One typeface (Archivo, self-hosted) and one role scale for the whole panel; 11px floor.
- Tonal depth: four surface steps and hairline borders; shadows only on floating layers.
- Every text token clears 4.5:1 on every surface it sits on, in both themes — enforced at build time.
- Theme-aware browser surfaces: caret, selection, focus ring, scrollbar and `<select>` lists all follow the palette.
- Sidebar + content shell; the sidebar becomes an off-canvas drawer below 1024px.

## Colors

A near-black monochrome ramp with one teal, and a small fixed vocabulary of status hues on tinted grounds.

Every colour in the admin is a `--c-*` variable from `src/admin-palette.css`,
named after its **original dark-mode hex** (the panel was converted from
~2,400 hardcoded values, so the names record provenance, not role). The light
theme redefines every variable under `<html data-admin-theme="light">`. The
role names below are the design vocabulary; the token in parentheses is what
to type.

### Primary
- **Signal Teal** (`--c-0d9488`, #0f766e dark / #0d796f light): the *Rebuild Public Site* button and the on-state of the theme switch. It is the only saturated colour in the chrome, and it means "this publishes something". Its hover is **Signal Teal Bright** (`--c-14b8a6`, #0b8276 / #0d7267). White text sits on it in both themes and is written as a literal `#fff` with a `token-lint-ignore` marker, because the inverted neutral ramp would turn it near-black in light mode.

### Neutral — surfaces (dark → light)
- **Page** (`--c-0a0a0a`, #0a0a0a / #f4f4f5): the content ground behind everything.
- **Panel** (`--c-111111`, #111111 / #ffffff): the sidebar, the rebuild bar, the table card and the top bar — the chrome layer.
- **Card** (`--c-141414`, #141414 / #fcfcfc): widgets, modals, inputs and the stat strip. In light mode this is the white-card-on-off-white-page step that makes the layout read.
- **Hover** (`--c-1a1a1a`, #1a1a1a / #efeff1): the hover ground for nav items, rows and stat cells — the darkest hover surface, and the one the text ramp is measured against.
- **Selected** (`--c-1f1f1f`, #222222 / #e9e9ec): the active nav item and the active career tab.
- **Hairline** (`--c-222222`, #262626 / #e4e4e7): every structural divider — sidebar edge, table header rule, card border, stat-strip gaps.
- **Control border** (`--c-2a2a2a`, #2a2a2a / #d8d8dd) and **Control border, strong** (`--c-333333`, #333333 / #cfcfd4): input and ghost-button edges; the modal panel's edge.

### Neutral — text (dark → light)
- **Ink** (`--c-e2e8f0`, #e2e8f0 / #15191e): headings, primary cell text, input text, the focus ring. The default foreground.
- **Ink Max** (`--c-ffffff`, #ffffff / #090909): the active nav item, the wordmark's "MS", the active-indicator bar. Reserved for "this is where you are".
- **Ink Strong** (`--c-d0d0d0`, #d0d0d0 / #292929): secondary cell text, version numbers, todo items.
- **Ink Body** (`--c-c0c0c0`, #c0c0c0 / #363636): field labels, row-button text, group headers on hover.
- **Ink Secondary** (`--c-94a3b8`, #94a3b8 / #4a5260): stat labels, venue cells, done-item hints.
- **Ink Muted** (`--c-64748b` → #8a96aa / #53617a; `--c-475569` → #8390a3 / #55637b): subtitles, placeholders, dates, hints, the modal close glyph. Retuned in Oct 2026 from the original slate values to clear 4.5:1 on the hover surface.
- **Ink Faint** (`--c-888888` → #979797 / #5c5c5c; `--c-aaaaaa` → #aaaaaa / #515151): nav-group headers, column headers, resting nav items, ghost-button text. The quietest text that is still text.

### Status (tinted ground + ink, dark → light)
- **OK** — ink `--c-34d399` (#34d399 / #056747) on ground `--c-14532d` (#14532d / #dbf1e0): publish buttons, done marks, the live badge.
- **Warn** — ink `--c-fbbf24` (#fbbf24 / #624803) on ground `--c-1a1740` (#1a1740 / #f2f3ff): the *pending review* badge.
- **Danger** — ink `--c-f87171` (#f87171 / #ac2933) on ground `--c-2d1212` (#2d1212 / #fff2f1): delete and discard buttons, field errors, the required asterisk, sign-out hover.
- **Info** — ink `--c-60a5fa` (#60a5fa / #1860af) on ground `--c-1e3a5f` (#1e3a5f / #e2eeff): the EN language badge and the scanned-ticket badge. The PL badge is Danger ink on `--c-3f1010`.

### Named Rules
**The One Light Rule.** Signal Teal appears on exactly two controls: the rebuild button and the theme switch. Nothing else in the chrome is saturated. A new primary action is Ink on `--c-e8e8e8`, not teal.

**The No Raw Hex Rule.** Every admin style uses `var(--c-…)`. `scripts/check-admin-colours.mjs` fails the build on a literal colour; the only sanctioned literal is `#fff` on a saturated button, marked `token-lint-ignore`.

**The Contrast Floor Rule.** Every token used as text clears 4.5:1 on the darkest hover surface in dark mode (`#1a1a1a`) and the lightest in light mode (`#efeff1`). `scripts/check-admin-contrast.mjs` pins 32 text tokens × 5 surfaces × 2 themes. Retune a value in the palette, never per component.

**The Status Means State Rule.** Green, amber, red and blue say what a thing *is* (live, pending, destructive, informational). They never colour a count, a heading or a tile for variety — the dashboard's six figures are all Ink.

## Typography

**Display Font:** Archivo Variable (self-hosted via `@fontsource-variable/archivo`; fallback ui-sans-serif, system-ui)
**Body Font:** Archivo Variable (same family)
**Label/Mono Font:** none — tabular figures come from `font-variant-numeric: tabular-nums lining-nums`, not a monospace face.

**Character:** One grotesk at every size. Archivo's tall x-height carries 13–14px UI text comfortably, which is why the dense rows sit at 1.4 leading rather than 1.5; its wide counters let 11px uppercase labels stay legible at 0.08em tracking. Headings tighten to −0.015em so the bold weight does not splay.

### Hierarchy
All sizes are the `--fs-*` role tokens in `src/style.css`; scoped styles reference the token, never a raw rem, so the ramp is identical on every screen.

- **Display** (700, 28px / `--fs-2xl`, line-height 1, −0.015em): dashboard stat figures only. Tabular numerals.
- **Headline** (700, 22px / `--fs-xl`, 1.2, −0.015em): the page title. One unlayered rule on `.main-content-body h1` applies it, so a view's `<h1>` needs no classes.
- **Section** (700, 18px / `--fs-lg`): the wordmark and section titles inside a long page.
- **Title** (700, 16px / `--fs-md`): widget titles (*EPK Versions*, *Band Career Level*), modal titles at 600.
- **Body** (400, 14px / `--fs-base`, 1.4): inputs, prose, the admin shell's base. Prose blocks step to 1.55 (`--lh-prose`).
- **UI** (500, 13px / `--fs-sm`, 1.4): nav items, table cells, buttons, checklist items. 600 when it is the primary action.
- **Small** (12px / `--fs-xs`): hints, secondary labels, row-button text, field labels at 600.
- **Label** (700, 11px / `--fs-2xs`, uppercase, 0.08em / `--track-caps`): nav-group headers, column headers, badges, metadata captions. The floor — nothing renders smaller.

### Named Rules
**The Eleven Pixel Floor Rule.** `--fs-2xs` (11px) is the smallest size in the panel. A design that needs smaller text needs less text.

**The One Face Rule.** No display pairing, no monospace costume. Hierarchy comes from weight (400 / 500 / 600 / 700) and the fixed rem scale, not from a second family.

**The Tabular Rule.** Tables, stat figures and anything with `.tabular-nums` use lining tabular numerals so dates and counts align in columns.

## Layout

A fixed sidebar and a fluid content column. The sidebar is 15.5rem wide,
sticky, full-height, on Panel with a Hairline right edge; it holds the
wordmark, an accordion nav (one group open per route), and a footer with the
UI-language select, the theme switch, the user and sign-out. The content column
runs the rebuild bar across the top (Panel, Hairline underneath) and the page
body beneath it, capped at 96rem so tables stop stretching on ultrawide
screens.

Every view wraps itself in `p-8`; one unlayered rule scales that gutter with
the viewport (`clamp(1rem, 1rem + 2vw, 2rem)`), so a phone gets 16px and a
desktop 32px without touching the views. Page content sits at `max-w-5xl` on
the dashboard and `max-w-3xl`/`max-w-4xl` on single-record editors; list views
run full width.

Spacing is Tailwind's 4px scale: 0.25rem between stacked list items, 0.5rem
between a label and its control, 0.75–1rem inside controls and cells, 1.25rem
widget padding, 2rem between page sections. Tight inside a group, generous
between groups; a heading carries more space above it than below.

Below 1024px the sidebar becomes an off-canvas drawer (`min(18rem, 86vw)`)
behind a 3.25rem top bar with a menu button and the wordmark; a button scrim
and the Escape key close it, and every navigation closes it. Grids collapse by
column count, not by shrinking type: the stat strip goes 6 → 3 columns, the
career checklist from `auto-fill minmax(16rem)` to one column.

## Elevation & Depth

Tonal, not cast. Depth is four surface steps — Page, Panel, Card, Hover — and
Hairline borders between them. Nothing at rest carries a shadow: cards, inputs,
tables and the sidebar are flat planes distinguished by a one-step lightness
change and a 1px line. Inputs carry a faint *inset* shadow
(`inset 0 1.5px 3px rgba(0,0,0,.35)`) so they read as recessed, which is the
one place the system uses a shadow to say "this takes input".

Shadows appear only where something floats above the page:

### Shadow Vocabulary
- **Modal panel** (`box-shadow: 0 24px 64px rgba(0,0,0,0.6)`): the dialog, over a `rgba(0,0,0,.65)` backdrop with `backdrop-filter: blur(4px)`.
- **Phone drawer** (`box-shadow: 0 12px 40px rgba(0,0,0,0.45)`): the sidebar when it slides in below 1024px.
- **Focus halo** (`0 0 0 3px color-mix(in srgb, var(--c-ffffff) 16%, transparent)`): inputs on focus and the primary button on hover — a translucent ring in the theme's Ink Max, so it reads in both themes.

### Named Rules
**The Flat-At-Rest Rule.** No card, table, input or button carries a drop shadow at rest. If two surfaces need separating, step the tone or draw a hairline.

**The Only-Floating-Things-Cast Rule.** A shadow means the element is above the page and can be dismissed. Modals and the drawer qualify; dropdown-like panels inside the page do not.

## Shapes

Gently rounded, with the radius tracking the element's size: 0.25rem on
badges and checkbox rows, 0.375rem on nav items, row buttons and the modal
close, 0.5rem on inputs, primary and ghost buttons, 0.75rem on cards, table
cards and the modal panel, and a full pill on avatars and the pending badge.
Borders are 1px Hairline or Control-border; nothing uses a thicker stroke, and
no element carries a coloured side border — the active nav item's indicator is
a 2px *inset* box-shadow in Ink Max, not a border. Containers clip their
children (`overflow: hidden`) so a header row or a stat cell never pokes past
the rounded corner.

Icons are 1rem (nav) or 1.25rem (top bar) outline SVGs at stroke-width 2 with
round caps and joins — Feather-style line icons drawn inline. Checklist marks
are SVG circles, not glyphs.

## Components

### Buttons
- **Shape:** gently rounded (0.5rem); row-level buttons tighter (0.375rem).
- **Primary** (`.btn-primary`, `.btn-add-primary`): Ink Max-adjacent fill (`--c-e8e8e8`) with Panel-coloured text, 13px / 600, 0.5rem × 1.25rem. The brightest neutral in the chrome: on a dark page it is the obvious thing to press, and in light mode it inverts to near-black on white. Hover lifts the fill to Ink Max with a 3px translucent halo. Disabled drops to 50% opacity (form variant) or Control-border fill with Ink Faint text (table variant).
- **Rebuild** (`.btn-rebuild`): the only teal button. Signal Teal fill, literal white text, hover to Signal Teal Bright. Disabled when nothing is dirty.
- **Ghost** (`.btn-ghost`): transparent, 1px Control-border-strong edge, Ink Faint text; hover fills Hover and brightens to Ink. Secondary actions in forms and widget headers.
- **Row** (`.btn-edit`, *Rider*, *Tickets*): 12px / 500, transparent with Control-border-strong edge, Ink Body text; hover fills Control-border and brightens.
- **Danger** (`.btn-delete`, `.btn-epk-discard`): transparent with a Danger-ground edge and Danger text; hover fills the ground. Never a filled red button — destructive actions stay outlined so they do not compete with the primary.
- **Status** (`.btn-epk-publish`, `.clw-advance-btn`): OK ink on OK ground, 12px / 600.
- **Focus:** every button, link and `[tabindex]` gets `outline: 2px solid var(--c-e2e8f0); outline-offset: 2px` on `:focus-visible` only.

### Chips / Badges
- **Style:** 11px / 700 uppercase, 0.05–0.08em tracking, 0.15rem × 0.5rem, 0.25rem radius (pill for *pending review*).
- **State:** status ink on its tinted ground — OK (active/live), Warn (pending), Info (scanned, EN), Danger ink on `--c-3f1010` (PL), Ink Muted on Hover (voided).
- **Language badges** (`.lang-badge`): fixed 2rem wide so EN and PL columns align down a bilingual form.

### Cards / Containers
- **Corner Style:** 0.75rem.
- **Background:** Card for widgets, modals and the stat strip; Panel for the table card and the sidebar.
- **Shadow Strategy:** none at rest (see Elevation).
- **Border:** 1px Hairline.
- **Internal Padding:** 1.25rem × 1.5rem for widgets; table cells 0.75rem × 1rem; stat cells 1rem × 1.25rem.
- **Stat strip:** one container, `grid` with a 1px gap whose Hairline colour shows through as dividers; each cell is a link that fills Hover on hover and lifts its label to Ink.

### Inputs / Fields
- **Style:** Card fill, 1px Control-border, 0.5rem radius, 0.5625rem × 0.75rem, 14px Ink text, faint inset shadow. Placeholder in Ink Muted. Selects hide the native arrow and draw a 12px chevron.
- **Label:** 12px / 600 Ink Body, 0.375rem above the control; required marker in Danger.
- **Hover:** border steps to `--c-3a3a3a`.
- **Focus:** border to `--c-aaaaaa` plus the 3px translucent halo; no outline.
- **Error / Disabled:** 12px Danger text beneath; disabled at 45% opacity with `not-allowed`.
- **Hint:** 11px Ink Faint beneath the control.
- **Bilingual rows** (`.trans-row`): a 2rem language badge, then the input, one row per locale from the registry.

### Navigation
- **Sidebar:** Panel, 15.5rem, Hairline right edge. Wordmark 18px / 800 at −0.03em ("Band" in Ink, "MS" in Ink Max) over an 11px uppercase "ADMIN".
- **Group headers:** 11px / 700 uppercase Ink Faint with a 14px chevron; hover fills `--c-161616`. A closed group containing the active route shows a 6px Ink Max dot.
- **Items:** 13px / 500 Ink Faint with a 1rem icon at 80% opacity; hover fills Hover and brightens to Ink. Active: Selected fill, Ink Max text at 600, icon at full opacity, and a 2px inset Ink Max bar on the left edge.
- **Footer:** the UI-language `<select>`, the theme switch (a pill toggle whose on-state is Signal Teal), a 1.75rem avatar with initials, and *Sign out*, whose hover turns Danger on `--c-1a0a0a`.
- **Mobile:** the drawer described in Layout; transitions 220ms `cubic-bezier(0.2,0,0,1)`, disabled under `prefers-reduced-motion`.

### Tables
- **Card:** Panel, 0.75rem radius, Hairline border, clipped.
- **Toolbar:** search input and filter selects on a Card-coloured strip; the row count sits far right in Ink Faint.
- **Header:** 11px / 600 uppercase Ink Faint, Hairline rule beneath; sortable columns carry a 10px chevron pair.
- **Rows:** 13px cells, `--c-1f1f1f` hairline between rows, hover fills `--c-181818`. Primary column in Ink at 500, secondary in Ink Strong, metadata in Ink Secondary; dates and times in tabular numerals. Paired values mirror their header (`19:00 / 20:00` under *Doors / Start*) rather than carrying icons.
- **Actions:** right-aligned row buttons; *Delete* last and outlined in Danger.
- **Empty state:** 14px Ink Faint, 3.5rem vertical padding, centred.

### Modal
Teleported to `<body>` under `.modal-overlay`, which carries the same
`color-scheme`, caret, selection and scrollbar rules as the shell. Card panel,
0.75rem radius, Control-border-strong edge, the one real drop shadow; header
1rem × 1.5rem with a 16px / 600 title and an Ink Muted close glyph; body
1.25rem × 1.5rem. Enters at 220ms `cubic-bezier(0.16,1,0.3,1)`, leaves at
150ms.

### Rebuild Bar (signature)
The one strip of chrome in the content column: Panel ground, a count pill
(*n pending changes*) that turns Signal Teal when the site is dirty, the
*Rebuild Public Site* button in Signal Teal, and a gear for rebuild settings.
With auto-rebuild on, the button hides and the bar only reports. It is the
desk's transport control — the single place the admin touches the live site.

### Browser surfaces
`color-scheme` follows the theme on `.admin-shell` and `.modal-overlay` (never
on `:root`, so the fan pages keep the UA default). `caret-color` is Ink;
`::selection` is Ink at 22% with Ink Max text; the scrollbar thumb is
Control-border-strong (hover `--c-444444`) on a transparent track at 6px; the
focus ring is 2px Ink. `<select>` option lists render Ink on Card.

## Do's and Don'ts

### Do:
- **Do** reference a `--c-*` token for every colour and a `--fs-*` token for every size; both lints run in `pnpm build`.
- **Do** step tone (Page → Panel → Card → Hover) or draw a 1px Hairline to separate surfaces.
- **Do** keep primary actions neutral (Ink on `--c-e8e8e8`) and outline destructive ones in Danger.
- **Do** mirror a column header in its cell (`19:00 / 20:00`) and use tabular numerals for anything that aligns.
- **Do** draw icons as inline outline SVGs at stroke-width 2 with round caps; checklist marks included.
- **Do** write a white label on a teal/blue/red button as a literal `#fff` with `token-lint-ignore` — the neutral ramp inverts in light mode.
- **Do** verify a new text token with `node scripts/check-admin-contrast.mjs` before using it as text.
- **Do** style page titles with a bare `<h1>`; the shell rule carries the role.

### Don't:
- **Don't** use Signal Teal on anything other than the rebuild action and the theme switch.
- **Don't** colour counts, headings or tiles with status hues for variety; status colour means state.
- **Don't** put a drop shadow on a card, table, input or button at rest.
- **Don't** add a coloured side border (`border-left: 3px …`) to a card, callout or list item; use a tinted ground with a matching 1px edge.
- **Don't** use emoji or Unicode glyphs (✓ ○ 🚪) as icons in chrome.
- **Don't** render anything below 11px or use a second typeface.
- **Don't** animate `width`, `height` or `padding`; progress bars scale with `transform: scaleX()` from `transform-origin: left`.
- **Don't** build an admin URL by hand — `adminUrl()` is the only source — or add a route the Caddy `@spa` matcher does not list.
