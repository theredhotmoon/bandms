# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Tech stack

| Layer | Library |
|---|---|
| UI framework | Vue 3 (Composition API, `<script setup>`) |
| Language | TypeScript (strict mode) |
| Routing | Vue Router 4 |
| Server state | TanStack Query v5 |
| Styles | Tailwind CSS v4 |
| Build | Vite 6 |

---

## Folder structure

```
src/
├── api/              # One file per API resource. Contains fetch functions only.
│                     # Always validate params before using them in URLs.
│
├── types/            # One file per domain type (TypeScript interfaces/types).
│
├── composables/      # Reusable Vue composables (use* naming convention).
│                     # One composable per logical concern.
│
├── components/
│   ├── auth/         # Login/register flow components.
│   │                 # AuthTabs.vue, SignInForm.vue, RegisterForm.vue
│   │
│   └── (root)        # Global layout components shared across all views.
│
├── views/            # THIN orchestrators only — compose components, nothing else.
│                     # No business logic, no inline data arrays, template ≤ ~50 lines.
│                     # Admin views live in views/admin/. The only non-admin views
│                     # left are LoginView, FanAccountView, TicketClaimView and
│                     # TechRiderPreviewView — public pages are served by web/
│                     # (Astro), never from here. See the root CLAUDE.md.
│
└── router/
    └── index.ts      # Route definitions + global navigation guards.
```

---

## Conventions

### Component naming
- PascalCase filenames for all `.vue` files.
- Prefix with the feature folder name for feature-specific components: `AuthTabs`, `AuthForm`.
- Generic UI primitives live in `components/ui/` with plain names: `Button.vue`, `Card.vue`.

### Props and emits — always typed
```ts
interface Props {
  activeTab: 'signin' | 'register'
}
defineProps<Props>()

defineEmits<{
  'update:activeTab': [value: 'signin' | 'register']
  success: []
}>()
```

### TypeScript strictness
- No `any`. Use `unknown` and narrow, or define a proper interface.
- Return types on all exported functions.
- `as Promise<SomeType>` over `as any` for `response.json()` calls.

### Views are thin orchestrators
- A view imports and composes components — nothing else.
- No reactive state in views (that belongs in a composable or child component).
- No template longer than ~50 lines.

### Locales come from `src/locales.ts`

`Lang` is **derived** from the registry there — never redeclare `'en' | 'pl'`,
and never write `const LOCALES = ['en', 'pl']` in a component. Editors build
their per-locale tab strips from `LOCALES` and their blank drafts from
`emptyBag()`, so a new language reaches every form with no edit to any of them.
`useLang()` narrows whatever `localStorage` holds through `isLocale()`.

Unlike the API and the public site, the admin registry has **no fallback chain**:
it edits raw translation bags, so an untranslated locale must render an empty
input, not the other language's text. See the root `CLAUDE.md` for the full
three-file picture.

### Two language axes — chrome and content

`useLang()` (`site_lang`) is the **content** locale: which translation of the
band's data the editor is working on. It is passed as `?lang=` and sits in every
TanStack `queryKey`.

`useUiLang()` (`admin_ui_lang`) is the **chrome** locale: which language the
menus, buttons and toasts are in. It drives `vue-i18n` and `<html lang>`.

**They are deliberately separate, and the storage keys must stay separate.** An
editor routinely proofreads English copy; making one control do both would
refetch every post, release and profile the moment someone changed the menu
language. `App.vue` watches the **chrome** axis for `<html lang>` — announcing
the page as Polish because the *content* being edited is Polish is the wrong
answer for a screen reader.

### Admin UI strings live in `src/i18n/`

One module per nav group, `en/` and `pl/`. `en/index.ts` is the schema source of
truth and `pl/index.ts` is typed `: MessageSchema`, so **a missing Polish key
fails `pnpm build`** with a TS2322.

**The types do NOT check call sites.** `t('shows.totally.bogus.key')` compiles
clean — `MessageSchema` only forces `pl` to mirror `en`. A mistyped key is
caught by `scripts/check-i18n-keys.mjs`, which runs ahead of `vue-tsc` in the
build and resolves every static `$t(…)` / `keypath=` reference against the
English catalogue. A *dynamically built* key is checked by neither, which is
why `fallbackLocale` still matters.

Read them with `$t('area.key')` in templates or
`useI18n().t` in script.

**Never put `as const` on `en/index.ts`.** It widens each value to its own
string *literal* type, and `MessageSchema` then demands the Polish value be the
identical English text — every translation becomes a type error.

**`@` is reserved syntax in a vue-i18n message.** It introduces a linked
message (`@:common.actions.save`), so a literal `your@email.com` in a catalogue
throws `Message compilation error: Invalid linked format` — **at runtime, when
the component first renders that key**. `vue-tsc` cannot see it (the value is a
valid `string`), so it ships green and then blanks the component: this took out
the entire sign-in form while the logged-in dashboard looked fine. Escape it as
`"your{'@'}email.com"`. The same applies to `|`, which separates plural forms.

**None of the three build guards can see this** — they read `.vue` files, and
`check-i18n-coverage.mjs` skips `src/i18n` outright. `src/i18n/catalogue.spec.ts`
is what closes it: it compiles every message in both catalogues through
vue-i18n, rejects a bare `@`, and asserts an escaped `{'@'}` still renders as a
plain `@`. It runs in the ordinary vitest suite, not in `pnpm build`.

**Polish needs three plural forms** (`1 koncert / 2 koncerty / 5 koncertów`).
vue-i18n's default rule is positional and only models two, so `pluralRules.pl`
in `src/i18n/plural.ts` is wired to `polishPluralIndex()` in
`src/utils/uiLocale.ts` — a util, not a composable, so vitest's `node`
environment can import it without a `localStorage` shim.

### Guards run ahead of `vue-tsc` in `pnpm build`

Each answers a different question, and a red one means something specific:

| Script | Fails when | Fix |
|---|---|---|
| `check-admin-strings.mjs` | a file in `MIGRATED` still has hardcoded text | move it to the catalogue, or append `i18n-ignore` with a reason |
| `check-i18n-keys.mjs` | a `$t('…')` key has no catalogue entry | fix the typo, or add the key |
| `check-i18n-coverage.mjs` | a file renders translations but is **not** in `MIGRATED`, **or** a component rendered inside a migrated area shows English while translating nothing | add its path to `MIGRATED` |
| `check-admin-colours.mjs` | a hardcoded colour (hex, `rgb()`/`hsl()`, `color: white`, `bg-[#…]`) in an admin style | use a `var(--c-…)`, or append `token-lint-ignore` with a reason — see *Admin colours* below |
| `check-admin-contrast.mjs` | a token used as `color:` is under 4.5:1 on a page surface, or a border/fill uses a token that has a `-line` twin | pick a passing token, use the twin, or `contrast-ignore: <reason>` — see *Admin colours* below |

One more check lives in the test suite rather than the build —
`src/i18n/catalogue.spec.ts`, which compiles every message and is the only
thing that catches an unescaped `@` (see above).

**The i18n checks all stop at `app/`.** The printed rider sheet is a Vue component in
`@bandms/rider-core` that takes its ~150 strings as a prop, so it satisfies
every one of them while holding no translations at all. Its own bundles are
checked by `packages/rider-core/src/labels/labels.spec.ts`; see *The sheet's
words are a required prop* in the root `CLAUDE.md`.

**The coverage guard asks two different questions**, and the second one exists
because the first has a blind spot. A component that renders *no* translations
matches nothing in `RENDERS`, so the "translates but unguarded" check cannot
see it; the string lint never looks outside `MIGRATED`; and the key guard only
resolves keys that exist. Between the three, a component could render an entire
English form inside an area whose PR had been reviewed and merged — which
happened four times (`AboutBioVariantSelect`, `EntityRelationsPanel`,
`ClipForm`, `SingleImageUpload`). So the guard also walks the import graph from
every `MIGRATED` file and flags any component reachable from one that shows bare
English while translating nothing.

Both guards share `scripts/lib/template-scan.mjs`. Keep it that way — two
copies of "what counts as copy" drifting apart is the same class of gap.

**`MIGRATED` is the ratchet.** Adding an area to the sweep means adding its
paths there, and the coverage guard exists because forgetting that step was the
single most repeated defect in the sweep — six reviews found five instances
(`TicketStatusBadge`, `ClipCategoryPicker`, `TableToolbar`, and the shared form
children). Each time the area read as *done* while a component inside it still
rendered English.

**Never list a path before its strings are migrated.** The lint then reports a
pass over English text, which is worse than no guard at all.

**`i18n-ignore` carries two meanings** — "genuinely fixed" (a wordmark, `PLN`,
a route path) and "deliberately deferred" (the pitch email bodies, pending
their language picker). Always write the reason after the marker; the next
person cannot tell them apart otherwise.

Since these run only inside `pnpm build`, the CI `Tests` job runs `pnpm build`
explicitly — without it they fire only on push-to-main, which is the #104/#105
failure shape.

### Admin colours are `--c-*` variables — never a raw hex

The admin has a dark and a light theme (`AdminThemeSwitch` in the sidebar,
`useAdminTheme()`, stored as `admin_theme`). Every colour is a variable from
`src/admin-palette.css`, redefined under `<html data-admin-theme="light">`;
App.vue owns that attribute, the way it owns `<html lang>`.

**Variables are named after their *original* dark-mode value**, and that is a
history, not a promise. The panel had ~2,400 hardcoded colours and no tokens,
so the conversion was mechanical and `var(--c-2a2a2a)` started out as
`#2a2a2a`. The typography/contrast retune (#159) then moved about 25 of them —
`--c-555555` is `#8a8a8a` in dark now, `--c-334155` is `#7e8a9c`. **Read the
value in `src/admin-palette.css`; never infer it from the name.** Tune a value
in the palette file, never per component.

**A raised text token has a `-line` twin for everything that is not text.**
The retune lifted the grey text ramp to 4.5:1, which made the same tokens far
too loud as borders, fills and toggle tracks — near-black borders in light
mode, an "off" switch that read as "on" in dark. So `--c-334155`, `-475569`,
`-555555`, `-64748b`, `-666666`, `-888888` and `-aaaaaa` each have a
`--c-<hex>-line` holding the pre-retune value. Use the twin for `border`,
`background`, `outline`, `box-shadow`, `fill` and `stroke`; use the base for
`color`.

`scripts/check-admin-contrast.mjs` enforces both halves in `pnpm build`: it
**scans `src/` for every token used as `color:`** (not a hand-kept list — that
one claimed to be exhaustive and missed placeholders and delete buttons at
~1:1) and checks each at 4.5:1 on the five page surfaces, and it fails any
non-text use of a token that has a twin. A label on a coloured fill goes in its
`ON_FILL` map; a decorative or disabled one-off takes
`contrast-ignore: <reason>` on its line.

**A raw hex in an admin style silently ignores the switch** — it renders
correctly in dark, which is what everyone tests in. Reuse an existing `--c-*`.
`scripts/check-admin-colours.mjs` fails `pnpm build` on one, naming the file
and line. It walks **all** of `src/` minus an explicit `EXCLUDED` list (the
palette, `style.css`, `App.vue`, the fan pages, the printable rider preview),
so a new admin folder is checked from its first file. It reads `<style>`
declaration values, `style`/`:style` attributes and Tailwind `bg-[#…]`-style
classes — never `<script>`, never comments, never a selector like `#app`.
Black `rgba(0,0,0,a)` passes (shadows and scrims are theme-neutral), and so
does `text-[#fff]`, because a marker cannot go inside a tag's class list.
What counts as a colour is `scripts/lib/colour-scan.mjs`, pinned by its spec.

Three deliberate exceptions. Only the first ever trips the check, and it
carries `token-lint-ignore: <reason>` on its line (the public site's lint
uses the same marker):

- **White text on a saturated button** (teal, blue, red) is a literal `#fff`
  plus the marker, or Tailwind `text-[#fff]`. `var(--c-ffffff)` and `text-white` both turn
  near-black in light mode, which on a teal button is unreadable.
- **Tailwind neutrals** (`zinc-*`, `white`) are flipped by overriding
  `--color-zinc-*` in `style.css`, so they need no change.
- **Brand and data colours** in `<script>` (streaming-service colours, the
  calendar's event palette) stay hex. A colour that a template turns into a
  tinted badge uses `color-mix(in srgb, ${c} 13%, transparent)` rather than
  appending an alpha suffix, because `var(--c-…)22` is not a colour.

`color-scheme` is set on `.admin-shell` and `.modal-overlay` only, so the fan
pages the SPA still serves keep the browser default.

### Modal forms carry the discard guard themselves

`AdminModal` owns one "Discard changes?" confirmation for every way out —
backdrop, ✕, Escape and Cancel. It learns whether there is anything to lose
in one of two ways, both in `src/composables/useDirtyGuard.ts`:

- **A form component inside the modal** calls
  `useModalGuard(isDirty, () => emit('cancel'))` and binds the returned
  `cancel` to its Cancel button. That is the whole wiring; the view adds
  nothing. Outside a modal the composable is inert and `cancel` just emits.
- **A view whose form is inline in the modal body** passes `:dirty` to
  `AdminModal` and routes its Cancel button through a template ref's
  `requestClose()`.

**Escape only closes a guarded modal.** A modal with neither a `dirty` prop
nor a registered form gets no Escape key at all, because it cannot know what
it holds, and Escape is pressed reflexively to dismiss autocomplete.

**`dirty` is declared through `withDefaults(…, { dirty: undefined })`, and
that default is load-bearing.** Vue casts an *absent* Boolean prop to
`false` unless a default exists, so without it every modal looked
declared-and-clean: the bridge was never consulted and Escape closed dirty
forms at once. That shipped in #185 and was caught only by a harness run.
A tri-state Boolean prop in this codebase needs that default.

An in-modal popover that consumes Escape (`PhotoMemberTags`,
`InstrumentIconPicker`, `ConfirmDialog`) must call `preventDefault()`;
`AdminModal` listens on `window`, which fires after every `document`
listener, and skips a consumed key.

### Composables
- Named `use*`, placed in `src/composables/`.
- One composable = one logical concern.
- Return only what consumers need; keep internal refs private.

---

## Security rules

### No `v-html` with untrusted content
- `v-html` is forbidden unless the content is explicitly sanitised first.

### Content Security Policy
`index.html` carries a `<meta http-equiv="Content-Security-Policy">` tag.
Update this policy whenever a new external domain (CDN, API) is added.

### API input validation (`src/api/`)
- Validate every parameter before it is interpolated into a URL.
- Use `assertSafeId()` (or equivalent guard) for numeric ID params.
- Never build URLs from unvalidated `route.params` directly.

### Router navigation guards (`src/router/index.ts`)
- A global `beforeEach` guard blocks params containing path-traversal sequences
  (`..`, `//`, backslash, URL-encoded variants) and redirects to `admin`. It must
  name a route that exists — vue-router throws on an unresolvable name, which
  would crash the guard instead of blocking the navigation.

### `autocomplete` on auth forms
- Password inputs carry `autocomplete="current-password"` or `autocomplete="new-password"`.

---

## Adding a new feature — checklist

1. **Type** — add interfaces to `src/types/<domain>.ts`.
2. **API** — add fetch functions to `src/api/<resource>.ts` with param validation.
3. **Composable** — extract stateful logic into `src/composables/use<Feature>.ts`.
4. **Components** — build in the appropriate subfolder under `src/components/`.
5. **View** — create/update a thin view that composes the components.
6. **Router** — add the route in `src/router/index.ts`; add a guard if needed.
7. **CSP** — if the feature hits a new external domain, update the CSP meta tag.
