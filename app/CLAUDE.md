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

### Three guards run ahead of `vue-tsc` in `pnpm build`

Each answers a different question, and a red one means something specific:

| Script | Fails when | Fix |
|---|---|---|
| `check-admin-strings.mjs` | a file in `MIGRATED` still has hardcoded text | move it to the catalogue, or append `i18n-ignore` with a reason |
| `check-i18n-keys.mjs` | a `$t('…')` key has no catalogue entry | fix the typo, or add the key |
| `check-i18n-coverage.mjs` | a file renders translations but is **not** in `MIGRATED` | add its path to `MIGRATED` |

A fourth check lives in the test suite rather than the build —
`src/i18n/catalogue.spec.ts`, which compiles every message and is the only
thing that catches an unescaped `@` (see above).

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
