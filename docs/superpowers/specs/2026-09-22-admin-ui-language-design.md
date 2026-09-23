# Admin UI language — the panel's chrome in the editor's language

**Date:** 2026-09-22
**Status:** approved design, not built
**Scope:** admin SPA (`app/`) only — no backend, no `web/`, no migration.

## Problem

The admin panel is English-only and has no way to change that. There is no
i18n library in `app/` (`vue-i18n` is not installed; grepping for `i18n`
across `app/src` and `packages/` returns nothing), and every chrome string is
a hardcoded English literal inline in a template — `AdminLayout.vue` writes
`Dashboard`, `Your Band` and `Admin` directly into the markup.

The band and its editors are Polish speakers. The public site has spoken both
languages for months — the locale registry, the per-locale content editors and
the `@bandms/site-copy` registry all exist — but the tool those people spend
their time in does not.

Measured surface: **110 `.vue` files, 26,201 lines**, containing 100
`toast.*` calls with literal messages, 201 `placeholder` attributes, 13
`aria-label` attributes, plus every heading, button, table column, empty state
and help text as a bare text node. Realistically **1,500–2,500 strings**.

## The distinction this design rests on

An admin panel has **two unrelated language axes**, and this repo already has
one of them.

| Axis | Question it answers | State today |
|---|---|---|
| **Content language** | "Which translation of the band's *data* am I editing?" | Exists: `useLang()`, `localStorage['site_lang']`, passed as `?lang=` by `usePosts`, `useReleases`, `useBandProfile` |
| **Chrome language** | "Which language are the buttons and menus in?" | **Missing — this design** |

A third thing, distinct from both: the per-locale tab strips inside forms
(`FaqEditor`, `TagForm`, `ClipForm`) edit *every* locale side by side. That is
why `app/src/locales.ts` deliberately carries no fallback chain.

The axes must stay independent. A Polish-speaking editor routinely proofreads
English copy, and should not have to read the menus in a language they are
merely *checking*.

## Goals

- A **chrome-language switcher** in the admin, offering the same locales as
  the public site, sourced from the existing registry.
- The choice **persists across reloads** on that browser.
- The choice is **independent** of the content-language axis — switching the
  chrome must not refetch a single record.
- A **missing Polish translation fails the build**, rather than rendering a
  key name or English text to a Polish user.
- New hardcoded English **cannot regress** an already-translated area.
- Every admin string translated, delivered as **reviewable PRs**, not one
  unreadable diff.

## Non-goals

- **Any backend change.** No migration, no `users.ui_locale`, no endpoint, no
  Pest test. The preference is `localStorage`-only, which matches how
  `useLang` and the auth token already work. Cost, accepted knowingly: the
  preference is per-browser, so a new device starts in English.
- **Touching the content-language axis.** `useLang`, the `?lang=` fetches and
  every `queryKey` are left exactly as they are.
- **The three surviving non-admin SPA views** — `FanAccountView` (`/account`),
  `TicketClaimView` (`/tickets/*`) and `TechRiderPreviewView`. They sit
  outside `AdminLayout` and so would have no switcher, and a fan's language
  should follow the public site rather than an admin's stored preference.
  A separate design.
- **A third locale.** Adding `de` stays one entry per registry file; this
  design must not introduce a fourth list, but it does not add the locale.
- **Translating band-authored content.** That is `@bandms/site-copy`.

## Section 1 — The i18n layer

**Library: `vue-i18n`**, latest v11.x, pinned at install rather than guessed.
Registered in `app/src/main.ts` beside `VueQueryPlugin`, in Composition mode
(`legacy: false`) — components use `useI18n()` in script and `$t()` in
templates; there is no Options API `this.$t` shim.

`app/vitest.config.ts` runs `environment: 'node'` with no plugins, and nothing
under test renders (component coverage is Playwright). So registering an i18n
plugin costs the unit suite nothing.

### New files

```
app/src/i18n/
  index.ts          createI18n(...) + setUiLocale()
  schema.ts         MessageSchema + DefineLocaleMessage augmentation
  plural.ts         pluralRules wiring
  en/index.ts       barrel — THE SCHEMA SOURCE OF TRUTH
  en/common.ts      shared: actions, table chrome, validation, confirmations
  en/shell.ts       AdminLayout nav, sign-in, dashboard
  en/<area>.ts      one module per nav group
  pl/index.ts       same barrel, typed as MessageSchema
  pl/<area>.ts
```

### Key safety

This is the part that earns the library its keep, and it is not vue-i18n's
default behaviour — it must be wired deliberately.

```ts
// en/index.ts — deliberately NOT `as const`
export default { common, shell, concerts, /* … */ }

// schema.ts
import en from './en'
export type MessageSchema = typeof en
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}

// pl/index.ts
const pl: MessageSchema = { common, shell, concerts, /* … */ }
export default pl
```

**`as const` must not be used on the English barrel.** It would widen each
value to its own string *literal* type, so `MessageSchema` would demand that
`pl.common.actions.save` be the literal `'Save'` — every Polish translation
would be a type error. Without it, `typeof en` gives the key structure with
`string` values, which is exactly the constraint wanted: **keys required,
values free**.

Two guarantees follow:

1. Adding an English string makes `pl/index.ts` **stop compiling** until it is
   translated.
2. A mistyped key such as `concerts.titel` is caught by
   `app/scripts/check-i18n-keys.mjs`, which runs ahead of `vue-tsc` in the
   build.

**This originally claimed a mistyped key was a type error. That was wrong.**
`DefineLocaleMessage` does not key-check call sites in this setup —
`t('shows.totally.bogus.key')` compiles clean under `vue-tsc -b` and renders
the raw dotted key on screen. Only guarantee 1 is enforced by types; guarantee
2 is enforced by the key checker, which exists because this claim was tested
and failed.

`pnpm build` (`vue-tsc -b && vite build`) enforces both. The `-b` matters:
`CLAUDE.md` documents that the plain `-p tsconfig.json` form loads a
solution-style config with an empty `files` array and type-checks **zero**
files, exiting 0 regardless of what is broken.

### No fourth locale list

`createI18n` reads `LOCALES` and `DEFAULT_LOCALE` from the existing
`app/src/locales.ts`; the switcher's labels come from its `nativeName()` and
`shortLabel()`. The registry stays the three files named in `CLAUDE.md`.

`fallbackLocale` is `DEFAULT_LOCALE` (`en`). This is a fallback that should
never fire for a static key, now that the key checker runs in the build — and exists
only so a runtime surprise degrades to English rather than to a raw key.

### Polish plurals

`pluralRules.pl` is written explicitly, returning the *one / few / many*
index: `1 koncert`, `2–4 koncerty`, `5+ koncertów`, with the teens exception
(`12 koncertów`) and the decade rule (`22 koncerty`, `25 koncertów`).

vue-i18n's default pluralization is positional by message index, which is
correct for English and silently wrong for Polish.

### Message compiler

Messages stay plain JS objects and compile at runtime; no
`@intlify/unplugin-vue-i18n`. It costs a few kB in a bundle that sits behind
auth and appears on no public page. Precompiling is a later, self-contained
change if it ever matters.

## Section 2 — The switcher, persistence and the `lang` attribute

**`app/src/utils/uiLocale.ts`** — the pure logic:

- `resolveStoredLocale(raw: string | null): Lang` — validates through the
  registry's existing `isLocale()`, falling back to `DEFAULT_LOCALE`. A locale
  removed from the registry must not leave someone pinned to a language the
  app no longer ships.
- `polishPluralIndex(n: number): 0 | 1 | 2`

**`app/src/composables/useUiLang.ts`** — a thin `localStorage` wrapper around
those, shaped like the existing `useLang`/`useAuth`: a module-level singleton
ref, read once at module load.

Storage key **`admin_ui_lang`** — deliberately *not* `site_lang`.

> `useLang.ts` reads `site_lang` at module load, before any component mounts,
> and its value feeds every content `queryKey`. Reusing the key would mean
> switching the chrome to Polish silently refetched every post, release and
> profile in a different locale. Two keys is what makes the two axes actually
> independent.

**`app/src/components/admin/UiLangSwitcher.vue`** — placed in the
`AdminLayout.vue` sidebar footer, beside the user block and Logout. Persistent
and reachable from every admin screen rather than buried in a settings page.

**`App.vue:13` changes owner.** The watcher currently syncing
`document.documentElement.lang` to the *content* locale moves to the UI locale.
As written it tells a screen reader the page is Polish because the editor
happens to be proofreading Polish copy — the wrong axis for WCAG 3.1.1.

## Section 3 — Catalogue organisation and key naming

Keys are `<area>.<surface>.<element>`:

```
common.actions.save          common.table.noResults
common.confirm.deleteTitle   shell.nav.yourBand
concerts.form.venueLabel     concerts.toast.created
```

Rules:

- **Shared strings live in `common`.** "Save", "Cancel", "Delete", "Are you
  sure?" are declared once. Duplicating them per view is how the wording
  drifts.
- **One module file per nav group**, matching the PR seams below, so an area
  PR touches one English file and one Polish file.
- **Keys are permanent once shipped** — the same rule as `@bandms/site-copy`,
  for the weaker reason that a rename is a silent no-op rather than data loss.

## Section 4 — The guardrail lint

**`app/scripts/check-admin-strings.mjs`**, modelled on the existing
`web/scripts/check-tokens.mjs`, fails on bare text nodes and hardcoded
`placeholder` / `aria-label` / `title` attributes in `app/src/**/*.vue`, with
an `i18n-ignore` line comment escape hatch mirroring `token-lint-ignore`.

It carries a **`MIGRATED` path list that each PR extends**, and checks only
those paths. It cannot police the whole app from PR 1, because PRs 2–6 have
not run yet; scoping it to finished areas makes it a one-way ratchet that
stops a translated view regressing — which, over six PRs, is the failure that
actually happens.

Wired into `app/package.json`'s `build` script so CI enforces it, the way
`web`'s token lint already is.

## Section 5 — Rollout

The nav groups in `AdminLayout.vue`'s `groupRoutes` already define the seams.

| PR | Scope | Approx. keys |
|---|---|---|
| 1 | Layer, switcher, `common` + `shell`, shared components (`AdminModal`, `ConfirmDialog`, `TableToolbar`, `SortHeader`, `Pagination`, `RebuildBar`), Dashboard, `AdminEntry` sign-in, the guardrail lint | ~250 |
| 2 | **Shows** — concerts, tours, venues, door | ~250 |
| 3 | **Content** — posts, press-releases, pitch, newsletter, authors | ~300 |
| 4 | **Your Band** — profile, members, releases, music-videos, clips, photos, calendar, setlists (11 views; may split) | ~450 |
| 5 | **Tech rider** — 13 `components/tech-rider/` + 7 `components/rig/` | ~250 |
| 6 | **More + Page config** — shop, bands, tags, instruments, users, website-modules, faqs, hero-images | ~350 |

Every PR lands `en/` **and** `pl/` for its area — the schema typing makes an
English-only PR impossible to compile. Polish is drafted in the PR and
reviewed by the repo owner as part of that PR's review; domain vocabulary
(*rider techniczny*, *setlista*, *wpis*, *zgłoszenie*) is where a drafted
translation is most likely to be wrong.

The panel is fully usable in Polish from PR 1; PRs 2–6 widen the coverage.

**The implementation plan that follows this spec covers PR 1 only.** It is the
only PR with design content — the layer, the switcher, the schema wiring, the
plural rule and the lint. PRs 2–6 are mechanical repetitions of one procedure
(lift strings from an area's components into its catalogue module, translate,
extend `MIGRATED`, verify), and each gets a short plan of its own when it is
picked up rather than being guessed at now.

## Section 6 — Testing

Per the table in `CLAUDE.md` — a feature is not done until a test exercises it
the way a person would.

**`e2e/tests/admin/ui-language.spec.ts`** (PR 1):

- Switch to Polish, and the sidebar nav renders Polish.
- Reload, and the choice persisted.
- `document.documentElement.lang` is `pl`.
- The **content**-language control is unaffected, and no content refetch is
  triggered — the assertion that pins the two axes apart.
- Switch back to English in teardown.

It writes only `localStorage`, scoped to the Playwright context, so it needs
no database restore. It publishes nothing, so it belongs in the parallel
`chromium` pool rather than a chained project.

**`app/src/utils/uiLocale.spec.ts`** (PR 1):

- `resolveStoredLocale()` for a valid value, an unrecognised value, and `null`.
- `polishPluralIndex()` for 1, 2, 5, 12, 22, 25.

Two placement constraints, both documented in `CLAUDE.md` and both easy to
get wrong:

1. The pure logic lives in **`src/utils/`, not in the composable**.
   `app/vitest.config.ts` runs `environment: 'node'`, and `useUiLang.ts` reads
   `localStorage` at module load — importing it from a spec dies with
   `localStorage.getItem is not a function`. Same reason `riderDiff`,
   `venueGate` and `heroImageScopes` are utils.
2. The file must be **`.spec.ts`**. `app/vitest.config.ts` includes
   `src/**/*.spec.ts` only; a `.test.ts` there is collected as nothing and the
   suite goes green having run zero tests.

Subsequent PRs add no new spec files — the guardrail lint plus `vue-tsc -b`
are what prove an area is migrated.

## Section 7 — Verification per PR

```bash
cd app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
bash scripts/test-all.sh
bash rebuild.sh
```

Clearing `.tsbuildinfo` matters: `-b` is incremental, and a stale cache from a
cleaner state of a file masks an error introduced since.

`rebuild.sh` is required, not optional — the SPA is **baked into the
`frontend` image at build time**, so `docker compose restart frontend` cannot
show a source change.

## Decisions taken during design

| Decision | Choice | Reason |
|---|---|---|
| Relationship to content language | Two independent switches | An editor proofreads the other locale's copy routinely |
| Persistence | `localStorage` only | No backend work; matches `useLang` and the auth token; accepted cost is per-browser |
| Mechanism | `vue-i18n` | Chosen over an in-house typed catalogue; schema typing recovers the compile-time guarantee |
| Rollout | Mechanism + full sweep over ~6 PRs | One diff of 1,500 strings is unreviewable; a partial sweep leaves the panel visibly half-translated |
| Polish authorship | Drafted in each PR, reviewed by the owner per PR | Domain vocabulary needs a native speaker; per-PR keeps the review surface small |

## Risks

- **Scale.** 1,500–2,500 strings across 110 files is the bulk of the work, and
  the estimate counts string *sites*, not verified strings. PR 4 may need
  splitting once its real size is known.
- **Bare text nodes are hard to lint.** `check-admin-strings.mjs` parses
  templates with a regex, not a Vue compiler AST. It will need an allowlist
  for genuinely-fixed strings (the `BandMS` wordmark, `EN`/`PL`), and it may
  need tightening as areas land. It is a ratchet, not a proof.
- **The `lang` attribute reassignment is a behaviour change**, invisible to
  every test the repo currently has. The E2E assertion above is what pins it.
