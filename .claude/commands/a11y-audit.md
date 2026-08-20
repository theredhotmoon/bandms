# Accessibility Audit

Conduct a comprehensive accessibility audit of the application. Covers WCAG 2.2 AA,
WAI-ARIA 1.2, keyboard/focus, screen readers, colour contrast, motion, cognitive
accessibility, and Vue 3-specific patterns. Produces a prioritised report and applies
fixes where possible.

Target: **WCAG 2.2 Level AA** — the legal baseline under the European Accessibility
Act (EAA, enforced June 28 2025), EN 301 549, and ADA/Section 508. Poland and all
other EU member states are in scope.

Scope: $ARGUMENTS (default = entire `app/` frontend + public-facing pages)

---

## Phase 1 — Automated scan

Run automated checks first. These catch ~30–40% of issues with zero false positives.

### 1.1 axe-core via Playwright (preferred — integrates with existing E2E suite)

```bash
# Install once
cd app && pnpm add -D @axe-core/playwright

# Add to any existing Playwright spec, or create a new one:
# e2e/a11y.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PAGES = [
  { name: 'home',    path: '/' },
  { name: 'merch',   path: '/merch' },
  { name: 'contact', path: '/contact' },
]

for (const page of PAGES) {
  test(`${page.name} — no axe violations`, async ({ page: p }) => {
    await p.goto(page.path)
    const results = await new AxeBuilder({ page: p })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}
```

```bash
make test-all   # or: cd app && pnpm exec playwright test e2e/a11y.spec.ts
```

### 1.2 Lighthouse CLI (quick per-page score + additional checks)

```bash
# Requires Chrome. Run against the dev server (pnpm dev in another terminal)
npx lighthouse http://localhost:5173 --only-categories=accessibility --output=json \
  --output-path=./a11y-report.json --chrome-flags="--headless"
```

Acceptable threshold: **≥ 90** for all public routes. Lighthouse uses axe-core
internally but also checks aria-* usage patterns not in axe alone.

### 1.3 pa11y CI sweep (optional, good for sitemap-level checks)

```bash
# pa11y.config.cjs
module.exports = {
  standard: 'WCAG2AA',
  runners: ['axe'],
  urls: [
    'http://localhost:5173/',
    'http://localhost:5173/merch',
    'http://localhost:5173/contact',
  ],
}
# npx pa11y-ci --config pa11y.config.cjs
```

### 1.4 vitest-axe (unit-level — components with complex ARIA)

```bash
pnpm add -D vitest-axe
```

```ts
// Use in component tests for interactive widgets (modals, dropdowns, carousels)
import { render } from '@testing-library/vue'
import { axe, toHaveNoViolations } from 'vitest-axe'
expect.extend(toHaveNoViolations)

it('modal is accessible', async () => {
  const { container } = render(MyModal, { props: { open: true } })
  expect(await axe(container)).toHaveNoViolations()
})
```

---

## Phase 2 — WCAG 2.2 AA Manual Checklist

Work through each principle. Mark each item: ✅ Pass | ❌ Fail | ⚠️ Partial | N/A

### PERCEIVABLE (P)

#### Text alternatives (1.1)
- [ ] **1.1.1 A** — every `<img>` has meaningful `alt`; decorative images use `alt=""`
- [ ] **1.1.1 A** — icon-only buttons have `aria-label` or visually-hidden text span
- [ ] **1.1.1 A** — SVG icons: `aria-hidden="true"` on decorative; `role="img"` + `<title>` on meaningful

#### Time-based media (1.2) — skip if no audio/video
- [ ] **1.2.1 A** — audio-only / video-only has transcript or audio description
- [ ] **1.2.2 A** — captions provided for pre-recorded video
- [ ] **1.2.3 A** — audio description or media alternative for pre-recorded video
- [ ] **1.2.4 AA** — captions for live audio in synchronised media

#### Adaptable (1.3)
- [ ] **1.3.1 A** — semantic HTML used: `<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`, `<article>`
- [ ] **1.3.1 A** — headings form a logical hierarchy (h1 → h2 → h3); no skipped levels
- [ ] **1.3.1 A** — data tables use `<th scope="col/row">`, `<caption>`, no layout tables
- [ ] **1.3.1 A** — form inputs associated with `<label>` (via `for`/`id`) or `aria-label`
- [ ] **1.3.2 A** — reading order makes sense without CSS (tab through visually confirms)
- [ ] **1.3.3 A** — instructions don't rely on shape, size, colour, or location alone
- [ ] **1.3.4 AA** — no orientation lock (portrait/landscape both functional)
- [ ] **1.3.5 AA** — input fields expose `autocomplete` attributes (`name`, `email`, `tel`, etc.)

#### Distinguishable (1.4)
- [ ] **1.4.1 A** — colour is not the only means of conveying info (error states use icons/text too)
- [ ] **1.4.2 A** — audio that auto-plays >3 s has pause/stop/volume control
- [ ] **1.4.3 AA** — text contrast ≥ **4.5:1** (normal text) / **3:1** (large text ≥ 18pt or 14pt bold)
- [ ] **1.4.4 AA** — text resizes to 200% without loss of content or functionality
- [ ] **1.4.5 AA** — images of text avoided; CSS text preferred
- [ ] **1.4.10 AA** — content reflows at 320px width without horizontal scroll (no 2D scrolling)
- [ ] **1.4.11 AA** — UI components and meaningful graphics contrast ≥ **3:1** vs adjacent colours
- [ ] **1.4.12 AA** — text spacing overrides (line-height 1.5×, letter/word spacing) don't break layout
- [ ] **1.4.13 AA** — hover/focus tooltips: dismissible (Esc), hoverable, persistent

### OPERABLE (O)

#### Keyboard accessible (2.1)
- [ ] **2.1.1 A** — all functionality reachable and operable by keyboard alone
- [ ] **2.1.2 A** — no keyboard trap; Esc always provides a path out of a component
- [ ] **2.1.4 A** — single-char keyboard shortcuts either remappable, turn-off-able, or require modifier key

#### Enough time (2.2)
- [ ] **2.2.1 A** — timed content can be turned off, adjusted, or extended (≥ 10× default)
- [ ] **2.2.2 A** — moving/blinking/auto-updating content can be paused/stopped

#### Seizures & physical reactions (2.3)
- [ ] **2.3.1 A** — nothing flashes >3 times per second

#### Navigable (2.4)
- [ ] **2.4.1 A** — skip-to-main-content link present and visible on focus
- [ ] **2.4.2 A** — every page has a descriptive `<title>`
- [ ] **2.4.3 A** — focus order preserves meaning and operability
- [ ] **2.4.4 A** — link purpose clear from link text alone or context (no "click here")
- [ ] **2.4.6 AA** — headings and labels are descriptive
- [ ] **2.4.7 AA** — keyboard focus indicator is always visible (never `outline: none` without custom replacement)
- [ ] **2.4.11 AA** *(WCAG 2.2 new)* — focused element is not completely hidden behind sticky headers/footers
- [ ] **2.4.13 AAA** *(best practice)* — focus indicator: area ≥ component perimeter × 2px, contrast ≥ 3:1

#### Input modalities (2.5)
- [ ] **2.5.1 A** — all multi-point gestures (pinch, swipe) have single-pointer equivalents
- [ ] **2.5.2 A** — pointer actions trigger on up-event, not down-event (abort/undo possible)
- [ ] **2.5.3 A** — visible label matches the accessible name (no mismatch between `aria-label` and text)
- [ ] **2.5.7 AA** *(WCAG 2.2 new)* — drag-and-drop has a single-pointer alternative
- [ ] **2.5.8 AA** *(WCAG 2.2 new)* — touch targets are ≥ **24×24 CSS px** (or have adequate spacing)

### UNDERSTANDABLE (U)

#### Readable (3.1)
- [ ] **3.1.1 A** — `<html lang="pl">` / `<html lang="en">` set correctly per locale
- [ ] **3.1.2 AA** — inline language changes marked with `lang` attribute (`<span lang="en">`)

#### Predictable (3.2)
- [ ] **3.2.1 A** — focus alone doesn't trigger context change
- [ ] **3.2.2 A** — input alone doesn't trigger context change without warning
- [ ] **3.2.3 AA** — navigation is consistent across pages
- [ ] **3.2.4 AA** — components that do the same thing are identified consistently
- [ ] **3.2.6 A** *(WCAG 2.2 new)* — help mechanism (contact link, FAQ) appears in same relative position across pages

#### Input assistance (3.3)
- [ ] **3.3.1 A** — form errors identified in text; error message describes the issue
- [ ] **3.3.2 A** — labels or instructions provided for all inputs
- [ ] **3.3.3 AA** — error suggestions provided (e.g. "Enter a valid email like name@example.com")
- [ ] **3.3.4 AA** — for legal/financial transactions: review/confirm step or reversal possible
- [ ] **3.3.7 A** *(WCAG 2.2 new)* — previously entered info auto-populated or preserved within session (no redundant entry)
- [ ] **3.3.8 AA** *(WCAG 2.2 new)* — authentication doesn't require solving cognitive function tests (CAPTCHA alternatives: copy-paste, biometric, email link)

### ROBUST (R)

#### Compatible (4.1)
- [ ] **4.1.2 A** — all UI components have name, role, value (custom controls use ARIA)
- [ ] **4.1.3 AA** — status messages (success toasts, loading states, errors) use `role="status"` or `aria-live`

---

## Phase 3 — Keyboard & Focus Manual Test

Unplug the mouse. Navigate every page and flow using keyboard only.

**Keys to exercise:**
- `Tab` / `Shift+Tab` — forward/backward through focusable elements
- `Enter` / `Space` — activate buttons and links
- `Arrow keys` — within widgets (menus, tabs, carousels, datepickers)
- `Esc` — close modals, tooltips, dropdowns; cancel actions
- `Home` / `End` — first/last item in listboxes and grids

**Check for:**
- [ ] Focus is always visible — never invisible or off-screen
- [ ] Focus order is logical (top → bottom, left → right in LTR)
- [ ] Modal/dialog traps focus inside while open; restores focus to trigger on close
- [ ] Dropdown menus: `Enter`/`Space` opens, arrows navigate, `Esc` closes
- [ ] No focus-order surprises caused by CSS `order` or `position: absolute`
- [ ] Route changes (Vue Router) move focus to a meaningful element (see § Vue patterns)

---

## Phase 4 — Screen Reader Testing

Recommended pairings (covers ~85% of screen reader users):

| Priority | Screen Reader | Browser | Platform |
|----------|--------------|---------|----------|
| 1 (start here) | **NVDA** (free) | Firefox | Windows |
| 2 | **VoiceOver** (built-in) | Safari | macOS/iOS |
| 3 (enterprise) | **JAWS** (licensed) | Chrome/Edge | Windows |

**Navigation patterns to verify:**
- [ ] **Headings** — press `H` (NVDA/JAWS) to jump between headings; hierarchy makes sense
- [ ] **Landmarks** — press `D` to move between `<main>`, `<nav>`, `<header>`, `<footer>`
- [ ] **Links** — press `K`; every link makes sense read in isolation
- [ ] **Forms** — `F` jumps to inputs; labels are announced; errors read out
- [ ] **Buttons** — role announced as "button"; state (`expanded`, `pressed`) announced
- [ ] **Dynamic content** — route changes, loading states, toast notifications announced via `aria-live`
- [ ] **Images** — `alt` text read; decorative images skipped
- [ ] **Tables** — column/row headers announced when navigating cells

**NVDA quick start (Windows):**
```
Download: https://www.nvaccess.org/download/
Toggle speech: Insert+S
Browse mode: Insert+Space
List headings: Insert+F7
```

**VoiceOver quick start (macOS):**
```
Toggle: Cmd+F5
Web rotor: Ctrl+Option+U
Next heading: Ctrl+Option+Cmd+H
```

---

## Phase 5 — Colour & Visual Checks

Use browser DevTools or one of these free tools:

- **Chrome DevTools** — Elements panel → Contrast ratio shown in colour picker
- **WebAIM Contrast Checker** — https://webaim.org/resources/contrastchecker/
- **Who Can Use** — https://www.whocanuse.com/ (shows real user impact)

**Contrast matrix to check for this project's CSS accent variable:**

| Element type | AA minimum | AAA target |
|---|---|---|
| Body text (< 18pt / < 14pt bold) | **4.5 : 1** | 7 : 1 |
| Large text (≥ 18pt or ≥ 14pt bold) | **3 : 1** | 4.5 : 1 |
| UI components (borders, icons) | **3 : 1** | — |
| Focus indicators | **3 : 1** | — |

- [ ] All text passes 4.5:1 against background
- [ ] Large-text headings pass 3:1
- [ ] Form field borders and focus rings pass 3:1
- [ ] Disabled state contrast ≥ 3:1 OR clearly identifiable as disabled by another means
- [ ] Dark mode (if implemented) meets the same ratios

---

## Phase 6 — Motion & Animation

- [ ] All CSS animations wrapped in `@media (prefers-reduced-motion: reduce)` — replace with instant or opacity-fade
- [ ] JS-driven animations check `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
- [ ] Auto-playing carousels/sliders have a pause button visible on focus
- [ ] Nothing flashes faster than 3Hz
- [ ] Parallax effects reduced or eliminated when motion preference set

```css
/* Pattern — motion-first, reduce as override */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Phase 7 — Mobile Accessibility

Test with Chrome DevTools device emulation AND a real device if available.

- [ ] All touch targets ≥ **24×24 CSS px** (WCAG 2.5.8 AA); aim for 44×44px for primary actions
- [ ] Content reflows at 320px viewport width without horizontal scrolling
- [ ] Pinch-to-zoom not disabled (`<meta name="viewport">` must NOT include `user-scalable=no`)
- [ ] iOS VoiceOver + Safari: swipe navigation, double-tap activation work on all interactive elements
- [ ] Android TalkBack: verify on physical device or emulator if Android users are in scope

---

## Phase 8 — Cognitive Accessibility (COGA)

Beyond WCAG, follow W3C COGA guidance (https://www.w3.org/TR/coga-usable/):

- [ ] Language is plain and clear; avoid jargon (applies to PL and EN content equally)
- [ ] Error messages explain what went wrong and how to fix it
- [ ] Multi-step forms show progress (`Step 2 of 4`)
- [ ] Previously entered data is preserved on validation failure (no wiping the form)
- [ ] Timeouts warn the user and allow extension
- [ ] Authentication offers alternatives to memorising passwords (magic link, passkey) — WCAG 3.3.8
- [ ] Consistent navigation: logo → home, primary nav in same place on every page
- [ ] No distracting animations near text content

---

## Vue 3 — Specific Patterns

### Skip link (place at top of `App.vue`)

```vue
<template>
  <span ref="backToTop" tabindex="-1" style="position:absolute;top:-1px" />
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <RouterView />
</template>

<style>
.skip-link {
  position: fixed;
  top: 0; left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  padding: 0.5rem 1rem;
  background: #fff;
  border: 2px solid #000;
  z-index: 9999;
}
.skip-link:focus { opacity: 1; }
</style>
```

### Router focus management (restore focus on route change)

```vue
<!-- App.vue <script setup> -->
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const backToTop = ref<HTMLElement>()

watch(() => route.path, () => {
  backToTop.value?.focus()
})
```

### Unique IDs in reusable components (Vue 3.5+)

```vue
<script setup>
import { useId } from 'vue'
const id = useId()           // e.g. 'v-1a2b3c'
</script>

<template>
  <label :for="id">Email</label>
  <input :id="id" type="email" autocomplete="email" />
</template>
```

### ARIA live regions for dynamic announcements

```vue
<template>
  <!-- Polite: waits for user to finish interaction -->
  <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
    {{ statusMessage }}
  </div>

  <!-- Assertive: interrupts immediately (use sparingly — errors only) -->
  <div role="alert" aria-live="assertive" class="sr-only">
    {{ errorMessage }}
  </div>
</template>
```

### Modal focus trap pattern

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const dialog = ref<HTMLDialogElement>()

function trapFocus(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !dialog.value) return
  const focusable = dialog.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  }
}

onMounted(() => {
  dialog.value?.focus()
  document.addEventListener('keydown', trapFocus)
})
onUnmounted(() => document.removeEventListener('keydown', trapFocus))
</script>
```

### Hiding decorative content

```vue
<!-- Icon + visible label: hide the icon -->
<button type="button">
  <svg aria-hidden="true" focusable="false">...</svg>
  Submit
</button>

<!-- Icon only: label the button, not the icon -->
<button type="button" :aria-label="$t('nav.close')">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>

<!-- Visually hidden text utility class (add to app CSS) -->
<style>
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
}
</style>
```

### i18n + accessibility

- [ ] `<html :lang="locale">` updated when locale switches (EN ↔ PL)
- [ ] All `aria-label` values translated through `$t()`, not hard-coded English strings
- [ ] Number/date formatting uses `Intl` APIs, not manual string concatenation
- [ ] Right-to-left (RTL) support: if extending to Arabic/Hebrew, add `dir="rtl"` logic

---

## Phase 9 — Legal Compliance Summary

| Standard | Applies when | WCAG target | Enforced since |
|---|---|---|---|
| **EAA / EN 301 549** | Serving EU users (incl. PL) | 2.1 AA (2.2 AA recommended) | June 28, 2025 |
| **ADA** | US users | 2.1 AA (courts use 2.2 now) | Ongoing |
| **WCAG 2.2** | Best practice baseline | AA (87 criteria) | Oct 2023 standard |
| **WCAG 3.0** | Future | Scoring model, not pass/fail | 2026+ expected |

EAA penalties: up to €100,000 or 4% of annual revenue (varies by member state).
New products: compliant by June 28, 2025. Existing services: transitional until June 28, 2030.

---

## Phase 10 — Report & Fix

After running all phases, produce a prioritised findings table:

| # | WCAG SC | Severity | Element / Route | Description | Fix |
|---|---------|----------|-----------------|-------------|-----|
| 1 | 1.4.3 | 🔴 Critical | `.hero-cta` / `/` | Contrast 2.8:1 — fails AA | Change foreground to `#1a5c2a` |
| 2 | 2.4.7 | 🔴 Critical | `<input>` focus | `outline: none` with no replacement | Add `:focus-visible` ring |
| … | | | | | |

**Severity scale:**
- 🔴 **Critical** — blocks assistive tech users completely; legal exposure; fix before shipping
- 🟠 **Major** — significantly impairs AT users; fix in current sprint
- 🟡 **Minor** — degrades experience but not blocking; fix in next sprint
- 🔵 **Enhancement** — AAA / COGA best practice; schedule for backlog

After reporting, apply all 🔴 fixes immediately. For 🟠 and below, ask the user to
prioritise. Re-run `make test-all` after fixes and confirm axe violations = 0.

---

## Sources consulted during skill authoring

- [WCAG 2.2 — W3C Recommendation](https://www.w3.org/TR/WCAG22/)
- [What's New in WCAG 2.2 — WAI](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [WAI-ARIA 1.2 — W3C](https://www.w3.org/TR/wai-aria-1.2/)
- [Vue.js Accessibility Guide](https://vuejs.org/guide/best-practices/accessibility)
- [COGA — Making Content Usable](https://www.w3.org/TR/coga-usable/)
- [axe-core Playwright integration](https://playwright.dev/docs/accessibility-testing)
- [EAA Compliance Guide — accessible.org](https://accessible.org/european-accessibility-act/)
- [European Accessibility Act — European Commission](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)
- [prefers-reduced-motion — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [WCAG 2.5.8 Target Size](https://www.allaccessible.org/blog/wcag-258-target-size-minimum-implementation-guide)
- [Screen reader testing guide](https://testparty.ai/blog/screen-reader-testing-guide)
