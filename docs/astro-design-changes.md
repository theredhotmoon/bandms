# Astro Public Site — Design Changes Since Original Build

Comparing `8bd30dc` (original Astro scaffold, PR #9) → `bb78142` (brutalist restore).

---

## What changed and why it broke things

### 1. Global CSS — total design system swap

| Property | Original (`8bd30dc`) | After restore (`bb78142`) |
|---|---|---|
| **Background** | `rgb(8 8 8)` — near-black | `#EFE7D6` — cream/paper |
| **Text** | `rgb(240 240 240)` — off-white | `#121212` — ink |
| **Accent** | `oklch(72% 0.19 82)` — amber/orange | `#176b5c` — teal |
| **Font (body)** | Inter | Archivo |
| **Font (headings)** | Inter 700, -0.02em tracking | Anton 400, uppercase, 0.9 line-height |
| **Tailwind theme vars** | `--color-surface`, `--color-border`, `--color-muted` | `--color-ink`, `--color-paper`, `--color-accent` |

The original used Tailwind utility classes throughout (e.g. `bg-surface`, `text-zinc-400`,
`border-border`). After the restore, those class names no longer exist in the theme, so
every component that used them renders with no background, no border, and fallback browser
fonts. That is the root cause of the visual breakage.

---

### 2. Header

**Original:** Sticky dark bar, Tailwind classes (`bg-[rgb(8,8,8)/90]`, `backdrop-blur-md`,
`text-zinc-400`, `hover:text-white`), nav links small/medium weight.

**After:** Inline styles only, `background:#121212`, `border-bottom:4px solid #176b5c`,
`font:'Anton'` for brand, `font:'Archivo' 700 uppercase` for nav links.

**Problem introduced:** The Tailwind classes still exist in the template but the CSS
variables they reference were deleted, so any page that kept Tailwind classes for layout
(max-width, padding, flex) still works, but colour/font classes silently produce nothing.

---

### 3. Footer

**Original:** 2-column flex (brand + nav links), Tailwind `border-border`, `text-zinc-500`.

**After:** 3-column grid (brand / booking / nav), dark background `#121212`, cream text,
checker strip added at the top via `<CheckerStrip>`, inline styles throughout. Added a
"Booking → Contact us" column that didn't exist before.

---

### 4. Releases index (`/releases`)

**Original:** Grouped by type (LP / EP / single / compilation), no hero section, plain
`h1` with `text-4xl font-black text-white`.

**After:** Full-bleed dark hero with 72px Anton `h1`, checker strip, then grouped cards.
The hero section is new and works fine. The card grid below it relies on `ReleaseCard`
which had its Tailwind classes replaced with inline styles — mixing old and new broke the
card layout.

---

### 5. Release detail (`/releases/[id]`)

**Original:** Max-width centred layout, breadcrumb nav, `grid-cols-[220px_1fr]`,
Tailwind card styles for streaming links (`rounded-lg border border-border bg-surface`).

**After:** Full-bleed dark header with back link, checker strip, then the same grid — but
`border-border` and `bg-surface` CSS variables no longer exist, so streaming link buttons
render with no background/border on pages that weren't fully converted.

---

### 6. About, Concerts, Contact, Posts, Merch, EPK, Videos, Press

Same pattern across all pages:

- Old: Tailwind utility classes for layout + colour + typography
- New: Mix of inline styles (for the newly-added brutalist sections) + leftover Tailwind
  colour classes (for sections that weren't touched) → the colour classes silently fail
  because the theme variables were renamed

---

## Root cause summary

The restore commit **renamed all CSS custom properties** in `global.css` and switched the
design token set, but then only partially updated component/page templates. Any template
line that still references old class names like `text-zinc-*`, `bg-surface`, `border-border`,
`text-accent` (old amber), or `font-black` gets no visible styling — the class exists in
the HTML but maps to nothing in the new theme.

---

## What the original Astro site (`8bd30dc`) looks like

- Dark theme: near-black background, off-white text, amber/orange accent
- Inter font everywhere
- Standard Tailwind utility layout — clean, modern, generic
- All pages complete and functional

## What the restore tried to achieve

- Cream paper background, ink text, teal accent (matching Vue SPA admin colours)
- Anton display font + Archivo body (brutalist ska aesthetic)
- Checker strips, brutalist box-shadows, bold borders
- This IS the correct target design — but the execution was a partial update that left
  half the classes broken

---

## Recommended fix path

**Option A — Start from `8bd30dc` and apply the design system cleanly:**
1. Update `global.css` tokens (already done correctly in `bb78142`)
2. Do a single pass over every component/page replacing Tailwind colour/font classes
   with either inline styles or new Tailwind theme utilities that match the new token names
3. Do NOT mix inline styles and Tailwind classes for the same property on the same element

**Option B — Revert `bb78142`, keep `813e3c2` as base, redo the theme pass properly:**
Same as A but with a clean git history.

The design goal (ska brutalist aesthetic) is correct. Only the execution needs a clean,
complete pass.
