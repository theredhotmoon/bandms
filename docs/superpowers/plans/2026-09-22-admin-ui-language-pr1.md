# Admin UI Language — PR 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin panel a working chrome-language switcher and translate the shell, the shared table/modal chrome, the sign-in form and the dashboard into Polish — with a type system and a lint that stop the remaining five PRs regressing.

**Architecture:** `vue-i18n` in Composition mode, registered in `main.ts`. Catalogues live under `app/src/i18n/{en,pl}/`, one module per nav group. `en/index.ts` is the schema source of truth; `pl/index.ts` is typed against it, so a missing Polish key fails `vue-tsc -b`. A new `useUiLang` composable owns the choice and persists it to `localStorage['admin_ui_lang']` — a different key from the existing content-language `site_lang`, which is what keeps the two axes independent. Pure logic (locale resolution, the Polish plural rule) sits in `app/src/utils/` so it is unit-testable in vitest's `node` environment.

**Tech Stack:** Vue 3.5 + `<script setup>` + TypeScript strict, vue-i18n v11, Vite 6, Vitest 4 (`environment: 'node'`), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-admin-ui-language-design.md`

## Global Constraints

Every task's requirements implicitly include all of these.

- **English output must be byte-identical after migration.** The suite has ~178 Playwright specs asserting English strings (`getByRole('button', { name: '+ Add tag' })`, `getByText(/no tags/i)`). The default locale stays `en`, so every one of them must still pass unchanged. A migration that "improves" wording breaks specs in unrelated areas.
- **`en/index.ts` must NOT use `as const`.** It would widen values to string *literal* types, making `MessageSchema` demand that the Polish value be the identical English literal. Plain object → `typeof en` gives keys with `string` values, which is the constraint wanted: keys required, values free.
- **Unit test files under `app/src` must be named `*.spec.ts`.** `app/vitest.config.ts` sets `include: ['src/**/*.spec.ts', …]`; a `*.test.ts` there is collected as nothing and the run goes green having executed zero tests.
- **Anything unit-tested must live in `app/src/utils/`, not in a composable.** vitest runs `environment: 'node'`; a composable that reads `localStorage` at module load dies on import with `localStorage.getItem is not a function`.
- **Type-check with `pnpm build`, never `vue-tsc --noEmit -p tsconfig.json`.** `app/tsconfig.json` is solution-style with an empty `files` array — the `-p` form type-checks zero files and exits 0. Only the `-b` form inside `pnpm build` is real. Clear `tsconfig.app.tsbuildinfo` / `tsconfig.node.tsbuildinfo` first; `-b` is incremental and a stale cache masks new errors.
- **No backend changes.** No migration, no Laravel file, no Pest test. `make test` is unaffected.
- **Never hand-build an admin URL.** Use `adminUrl()` from `@/config/admin`.
- **Storage keys:** UI chrome is `admin_ui_lang`. The existing content locale is `site_lang` and must not be touched.
- **Commit trailer** on every commit:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `app/src/utils/uiLocale.ts` | Pure: stored-value resolution, Polish plural index, storage key constant |
| `app/src/utils/uiLocale.spec.ts` | Its vitest spec |
| `app/src/i18n/index.ts` | The `createI18n` instance |
| `app/src/i18n/schema.ts` | `MessageSchema` + `DefineLocaleMessage` augmentation |
| `app/src/i18n/plural.ts` | `pluralRules` adapter (clamps to the message's choice count) |
| `app/src/i18n/en/common.ts` | Shared chrome: actions, table, pagination, confirm, time, rebuild areas |
| `app/src/i18n/en/shell.ts` | Sidebar nav, roles, sign-in, skip link, language switcher |
| `app/src/i18n/en/dashboard.ts` | Dashboard + EPK version history |
| `app/src/i18n/en/index.ts` | English barrel — **schema source of truth** |
| `app/src/i18n/pl/{common,shell,dashboard,index}.ts` | Polish counterparts |
| `app/src/composables/useUiLang.ts` | Singleton ref + `localStorage` wrapper |
| `app/src/components/admin/UiLangSwitcher.vue` | The control |
| `app/scripts/check-admin-strings.mjs` | The guardrail lint |
| `app/e2e/tests/admin/ui-language.spec.ts` | Playwright spec |

**Modified:** `app/package.json`, `app/src/main.ts`, `app/src/App.vue`, `app/src/config/rebuildAreas.ts`, `app/src/config/rebuildAreas.spec.ts`, `app/src/components/admin/AdminLayout.vue`, `AdminModal.vue`, `ConfirmDialog.vue`, `Pagination.vue`, `TableToolbar.vue`, `RebuildBar.vue`, `EpkVersionHistory.vue`, `app/src/components/auth/SignInForm.vue`, `app/src/views/admin/AdminEntry.vue`, `app/src/views/admin/AdminDashboard.vue`.

**Deliberately out of PR 1:** `CareerLevelWidget.vue` (579 lines, its own career-scoring vocabulary) goes to PR 4 with Band Profile. It renders on the dashboard, so the dashboard shows one English widget until then — an accepted, visible seam, recorded here so it is not mistaken for a miss.

---

### Task 1: Pure locale utilities

**Files:**
- Create: `app/src/utils/uiLocale.ts`
- Test: `app/src/utils/uiLocale.spec.ts`

**Interfaces:**
- Consumes: `LOCALES`, `DEFAULT_LOCALE`, `isLocale`, `Lang` from `@/locales` (all already exist).
- Produces: `UI_LANG_STORAGE_KEY: 'admin_ui_lang'`, `resolveStoredLocale(raw: string | null): Lang`, `polishPluralIndex(n: number): 0 | 1 | 2`.

- [ ] **Step 1: Write the failing test**

Create `app/src/utils/uiLocale.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { UI_LANG_STORAGE_KEY, resolveStoredLocale, polishPluralIndex } from './uiLocale'

describe('UI_LANG_STORAGE_KEY', () => {
  // Sharing `site_lang` would make a chrome switch refetch every record in the
  // other content locale. The two axes are independent by design.
  it('is distinct from the content-language key', () => {
    expect(UI_LANG_STORAGE_KEY).toBe('admin_ui_lang')
    expect(UI_LANG_STORAGE_KEY).not.toBe('site_lang')
  })
})

describe('resolveStoredLocale', () => {
  it('accepts a locale the registry knows', () => {
    expect(resolveStoredLocale('pl')).toBe('pl')
  })

  it('falls back to the default for an unknown value', () => {
    expect(resolveStoredLocale('de')).toBe('en')
  })

  it('falls back to the default when nothing is stored', () => {
    expect(resolveStoredLocale(null)).toBe('en')
  })
})

describe('polishPluralIndex', () => {
  it('returns the singular form for exactly one', () => {
    expect(polishPluralIndex(1)).toBe(0)
  })

  it('returns the few form for 2-4', () => {
    expect(polishPluralIndex(2)).toBe(1)
    expect(polishPluralIndex(4)).toBe(1)
  })

  it('returns the many form for 5 and above', () => {
    expect(polishPluralIndex(5)).toBe(2)
  })

  it('returns the many form for zero', () => {
    expect(polishPluralIndex(0)).toBe(2)
  })

  // 12-14 are the exception to the "ends in 2-4" rule: 12 koncertow, not koncerty.
  it('returns the many form for the teens', () => {
    expect(polishPluralIndex(12)).toBe(2)
    expect(polishPluralIndex(13)).toBe(2)
    expect(polishPluralIndex(14)).toBe(2)
  })

  it('applies the decade rule above the teens', () => {
    expect(polishPluralIndex(22)).toBe(1)
    expect(polishPluralIndex(25)).toBe(2)
    expect(polishPluralIndex(112)).toBe(2)
    expect(polishPluralIndex(122)).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd app && pnpm vitest run src/utils/uiLocale.spec.ts
```

Expected: FAIL — `Failed to resolve import "./uiLocale"`.

- [ ] **Step 3: Write the implementation**

Create `app/src/utils/uiLocale.ts`:

```ts
/**
 * Pure helpers behind the admin's chrome language.
 *
 * They live here rather than in `useUiLang` because vitest runs this suite with
 * `environment: 'node'` — importing a composable that touches localStorage at
 * module load dies on import. Same reason riderDiff, venueGate and
 * heroImageScopes are utils.
 */
import { DEFAULT_LOCALE, isLocale, type Lang } from '@/locales'

/**
 * Deliberately not `site_lang`. That key drives the *content* locale and feeds
 * every TanStack queryKey; reusing it would make switching the menus to Polish
 * silently refetch every post, release and profile.
 */
export const UI_LANG_STORAGE_KEY = 'admin_ui_lang'

/**
 * An unrecognised stored value falls back to the default rather than being cast
 * through — a locale dropped from the registry must not pin someone to a
 * language the app no longer renders.
 */
export function resolveStoredLocale(raw: string | null): Lang {
  return isLocale(raw) ? raw : DEFAULT_LOCALE
}

/**
 * Polish has three plural forms, and vue-i18n's default rule (positional, by
 * message index) only models two. Without this, "5 koncerty" ships.
 *
 *   0 -> one   1 koncert
 *   1 -> few   2-4, 22-24, 32-34 ... koncerty
 *   2 -> many  0, 5-21, 25-31 ...  koncertow
 */
export function polishPluralIndex(n: number): 0 | 1 | 2 {
  const abs = Math.abs(n)
  if (abs === 1) return 0

  const lastTwo = abs % 100
  if (lastTwo >= 12 && lastTwo <= 14) return 2

  const last = abs % 10
  return last >= 2 && last <= 4 ? 1 : 2
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd app && pnpm vitest run src/utils/uiLocale.spec.ts
```

Expected: PASS, **13 tests**. Confirm the count — a green run of zero tests is the failure mode this repo has hit before.

- [ ] **Step 5: Commit**

```bash
git add app/src/utils/uiLocale.ts app/src/utils/uiLocale.spec.ts
git commit -m "Admin i18n: locale resolution and the Polish plural rule

Pure utils, in src/utils/ rather than the composable so vitest's node
environment can import them without a localStorage shim.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The i18n instance, schema typing and the `common` catalogue

**Files:**
- Modify: `app/package.json` (add the dependency)
- Create: `app/src/i18n/plural.ts`, `app/src/i18n/en/common.ts`, `app/src/i18n/en/index.ts`, `app/src/i18n/pl/common.ts`, `app/src/i18n/pl/index.ts`, `app/src/i18n/schema.ts`, `app/src/i18n/index.ts`
- Modify: `app/src/main.ts`

**Interfaces:**
- Consumes: `resolveStoredLocale`, `UI_LANG_STORAGE_KEY`, `polishPluralIndex` from Task 1.
- Produces: `i18n` (default export of `app/src/i18n/index.ts`) with `i18n.global.locale` writable; `MessageSchema` from `app/src/i18n/schema.ts`; message keys `common.*`.

- [ ] **Step 1: Install vue-i18n**

```bash
cd /c/Projects/bandms && pnpm --filter exp-01 add vue-i18n
```

Run from the **monorepo root** — `app/` is a pnpm workspace member and an install inside it alone will not link `@bandms/rider-core`. Record the resolved version; do not hand-edit `package.json`.

- [ ] **Step 2: Write the plural adapter**

Create `app/src/i18n/plural.ts`:

```ts
import { polishPluralIndex } from '@/utils/uiLocale'

/**
 * vue-i18n hands us the count and how many `|`-separated choices the message
 * actually has. Clamping matters: a two-choice Polish message would otherwise
 * be asked for index 2 and render nothing.
 */
export const pluralRules = {
  pl: (choice: number, choicesLength: number): number =>
    Math.min(polishPluralIndex(choice), Math.max(choicesLength - 1, 0)),
}
```

- [ ] **Step 3: Write the English `common` catalogue**

Create `app/src/i18n/en/common.ts`. Every value here is copied verbatim from the component it replaces — see the Global Constraints note on byte-identity.

```ts
export default {
  actions: {
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    deleting: 'Deleting…',
  },
  confirm: {
    deleteTitle: 'Confirm deletion',
    deleteMessage: 'This record will be permanently deleted. This action cannot be undone.',
  },
  table: {
    searchPlaceholder: 'Search…',
    searchLabel: 'Search',
  },
  pagination: {
    label: 'Pagination',
    range: '{from}–{to} of {total}',
    previous: 'Previous page',
    next: 'Next page',
  },
  time: {
    justNow: 'just now',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
  },
  rebuild: {
    pendingChanges: 'pending change | pending changes',
    rebuild: '↺ Rebuild Public Site',
    rebuilding: 'Rebuilding…',
    autoActive: 'Auto-rebuild is active — changes rebuild automatically',
    rebuildTitle: 'Rebuild the public site',
    settingsTitle: 'Rebuild settings',
  },
  rebuildAreas: {
    'band-profile': 'Band Profile',
    'band-members': 'Band Members',
    'hero-images': 'Hero Images',
    posts: 'Posts',
    'website-modules': 'Website Modules',
    concerts: 'Concerts',
    venues: 'Venues',
    setlists: 'Setlists',
    releases: 'Releases',
    photos: 'Photos',
    'music-videos': 'Music Videos',
    'press-releases': 'Press Releases',
    shop: 'Shop',
    faqs: 'FAQs',
  },
}
```

- [ ] **Step 4: Write the Polish `common` catalogue**

Create `app/src/i18n/pl/common.ts`:

```ts
export default {
  actions: {
    cancel: 'Anuluj',
    close: 'Zamknij',
    delete: 'Usuń',
    deleting: 'Usuwanie…',
  },
  confirm: {
    deleteTitle: 'Potwierdź usunięcie',
    deleteMessage: 'Ten rekord zostanie trwale usunięty. Tej operacji nie można cofnąć.',
  },
  table: {
    searchPlaceholder: 'Szukaj…',
    searchLabel: 'Szukaj',
  },
  pagination: {
    label: 'Paginacja',
    range: '{from}–{to} z {total}',
    previous: 'Poprzednia strona',
    next: 'Następna strona',
  },
  time: {
    justNow: 'przed chwilą',
    minutesAgo: '{n} min temu',
    hoursAgo: '{n} godz. temu',
  },
  rebuild: {
    pendingChanges: 'oczekująca zmiana | oczekujące zmiany | oczekujących zmian',
    rebuild: '↺ Przebuduj stronę',
    rebuilding: 'Przebudowywanie…',
    autoActive: 'Automatyczne przebudowywanie jest włączone — zmiany publikują się same',
    rebuildTitle: 'Przebuduj stronę publiczną',
    settingsTitle: 'Ustawienia przebudowy',
  },
  rebuildAreas: {
    'band-profile': 'Profil zespołu',
    'band-members': 'Skład zespołu',
    'hero-images': 'Zdjęcia nagłówkowe',
    posts: 'Aktualności',
    'website-modules': 'Moduły strony',
    concerts: 'Koncerty',
    venues: 'Miejsca',
    setlists: 'Setlisty',
    releases: 'Wydawnictwa',
    photos: 'Zdjęcia',
    'music-videos': 'Teledyski',
    'press-releases': 'Materiały prasowe',
    shop: 'Sklep',
    faqs: 'FAQ',
  },
}
```

Note `pendingChanges` carries **three** Polish forms against English's two. That is the whole point of `pluralRules.pl`.

- [ ] **Step 5: Write the barrels and the schema**

Create `app/src/i18n/en/index.ts`:

```ts
import common from './common'

/**
 * The schema source of truth. NOT `as const` — that would widen every value to
 * its own string literal type, and `pl` would then be required to repeat the
 * English text verbatim. Plain object gives "keys required, values free".
 */
export default { common }
```

Create `app/src/i18n/pl/index.ts`:

```ts
import type { MessageSchema } from '../schema'
import common from './common'

const pl: MessageSchema = { common }

export default pl
```

Create `app/src/i18n/schema.ts`:

```ts
import en from './en'

export type MessageSchema = typeof en

/**
 * Makes $t()/t() key-checked against the English catalogue, so a mistyped key
 * is a build error rather than a key name rendered on screen.
 */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
```

- [ ] **Step 6: Write the i18n instance**

Create `app/src/i18n/index.ts`:

```ts
import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE } from '@/locales'
import { resolveStoredLocale, UI_LANG_STORAGE_KEY } from '@/utils/uiLocale'
import { pluralRules } from './plural'
import en from './en'
import pl from './pl'
import './schema'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveStoredLocale(localStorage.getItem(UI_LANG_STORAGE_KEY)),
  // Should never fire — the schema typing makes a missing key impossible. It
  // exists so a runtime surprise degrades to English rather than a raw key.
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, pl },
  pluralRules,
})

export default i18n
```

- [ ] **Step 7: Register the plugin**

Modify `app/src/main.ts` — add the import and one `app.use()`:

```ts
import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './style.css'
import 'vue-sonner/style.css'

const app = createApp(App)

app.use(router)
app.use(VueQueryPlugin)
app.use(createPinia())
app.use(i18n)

app.mount('#app')
```

- [ ] **Step 8: Prove the schema typing actually bites**

This is the guarantee the whole design rests on — verify it rather than assume it.

```bash
cd app && node -e "const f='src/i18n/pl/common.ts';const s=require('fs').readFileSync(f,'utf8');require('fs').writeFileSync(f,s.replace(\"    close: 'Zamknij',\\n\",''))"
rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
```

Expected: **FAIL**, naming `close` as missing in the `pl` object literal. Then restore it:

```bash
cd app && git checkout src/i18n/pl/common.ts
rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
```

Expected: PASS. If the deletion did **not** fail the build, the augmentation or the `MessageSchema` annotation is not wired — stop and fix it before continuing, because every later task depends on this.

- [ ] **Step 9: Commit**

```bash
git add app/package.json pnpm-lock.yaml app/src/i18n app/src/main.ts
git commit -m "Admin i18n: vue-i18n instance, schema typing and shared chrome strings

pl/index.ts is typed against typeof en, so a missing Polish key fails
vue-tsc -b rather than rendering a key name. The English barrel is
deliberately not 'as const' — that would demand identical literals.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The switcher, persistence and the `lang` attribute

**Files:**
- Create: `app/src/composables/useUiLang.ts`, `app/src/components/admin/UiLangSwitcher.vue`, `app/e2e/tests/admin/ui-language.spec.ts`
- Modify: `app/src/App.vue:1-14`, `app/src/components/admin/AdminLayout.vue` (sidebar footer, ~line 277)
- Also add to: `app/src/i18n/{en,pl}/shell.ts` (created here, extended in Task 4)

**Interfaces:**
- Consumes: `i18n` (Task 2), `resolveStoredLocale`/`UI_LANG_STORAGE_KEY` (Task 1).
- Produces: `useUiLang(): { uiLang: Ref<Lang>, setUiLang(l: Lang): void }`; message keys `shell.uiLang.*`; DOM hook `data-testid="ui-lang-switcher"`.

- [ ] **Step 1: Write the failing E2E spec**

Create `app/e2e/tests/admin/ui-language.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The chrome language. Deliberately asserts that the *content* language is
 * untouched: both axes hold the same two values, so a mix-up produces working
 * code that is simply wrong, and nothing else in the suite would see it.
 *
 * Writes only localStorage, scoped to this browser context. test.use() loads
 * the stored auth state but never writes back to it, so the shared
 * e2e/.auth/admin.json cannot end up pinned to Polish.
 */
test.describe('Admin UI language', () => {
  test.describe.configure({ mode: 'serial' })

  test('switching to Polish translates the sidebar and survives a reload', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const switcher = page.getByTestId('ui-lang-switcher')
    await expect(switcher).toBeVisible()

    // Baseline: English chrome, and <html lang> follows it.
    await expect(page.locator('nav.sidebar-nav')).toContainText('Dashboard')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await switcher.selectOption('pl')

    await expect(page.locator('nav.sidebar-nav')).toContainText('Pulpit')
    await expect(page.locator('nav.sidebar-nav')).not.toContainText('Dashboard')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('nav.sidebar-nav')).toContainText('Pulpit')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  })

  test('the chrome language does not disturb the content language', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const before = await page.evaluate(() => localStorage.getItem('site_lang'))

    await page.getByTestId('ui-lang-switcher').selectOption('pl')
    await expect(page.locator('nav.sidebar-nav')).toContainText('Pulpit')

    const after = await page.evaluate(() => localStorage.getItem('site_lang'))
    expect(after).toBe(before)
    expect(await page.evaluate(() => localStorage.getItem('admin_ui_lang'))).toBe('pl')
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('admin_ui_lang'))
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd app && pnpm exec playwright test e2e/tests/admin/ui-language.spec.ts --project=chromium
```

Expected: FAIL — `getByTestId('ui-lang-switcher')` never becomes visible.

Note the command form: `pnpm test:e2e -- <file>` runs the **whole** suite in this repo; `pnpm exec playwright test <file>` is what scopes it.

- [ ] **Step 3: Write the composable**

Create `app/src/composables/useUiLang.ts`:

```ts
import { ref } from 'vue'
import { i18n } from '@/i18n'
import { resolveStoredLocale, UI_LANG_STORAGE_KEY } from '@/utils/uiLocale'
import type { Lang } from '@/locales'

export type { Lang }

// Module-level singleton, read once at load — the same shape as useLang and
// useAuth. Read via the pure resolver so an unknown stored value degrades.
const uiLang = ref<Lang>(resolveStoredLocale(localStorage.getItem(UI_LANG_STORAGE_KEY)))

export function useUiLang() {
  function setUiLang(l: Lang): void {
    uiLang.value = l
    localStorage.setItem(UI_LANG_STORAGE_KEY, l)
    i18n.global.locale.value = l
  }

  return { uiLang, setUiLang }
}
```

`document.documentElement.lang` is deliberately **not** set here — `App.vue` owns that watcher, so there is one writer.

- [ ] **Step 4: Add the `shell.uiLang` strings**

Create `app/src/i18n/en/shell.ts`:

```ts
export default {
  uiLang: {
    label: 'Panel language',
  },
}
```

Create `app/src/i18n/pl/shell.ts`:

```ts
export default {
  uiLang: {
    label: 'Język panelu',
  },
}
```

Register both in the barrels. `app/src/i18n/en/index.ts`:

```ts
import common from './common'
import shell from './shell'

export default { common, shell }
```

`app/src/i18n/pl/index.ts`:

```ts
import type { MessageSchema } from '../schema'
import common from './common'
import shell from './shell'

const pl: MessageSchema = { common, shell }

export default pl
```

- [ ] **Step 5: Write the switcher component**

Create `app/src/components/admin/UiLangSwitcher.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOCALES, isLocale, nativeName } from '@/locales'
import { useUiLang } from '@/composables/useUiLang'

const { t } = useI18n()
const { uiLang, setUiLang } = useUiLang()

function onChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isLocale(value)) setUiLang(value)
}
</script>

<template>
  <label class="ui-lang">
    <span class="sr-only">{{ t('shell.uiLang.label') }}</span>
    <select
      class="ui-lang-select"
      data-testid="ui-lang-switcher"
      :value="uiLang"
      @change="onChange"
    >
      <option v-for="locale in LOCALES" :key="locale" :value="locale">
        {{ nativeName(locale) }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.ui-lang { display: block; margin-bottom: 0.5rem; }

.ui-lang-select {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border-radius: 0.375rem;
  background: #141414;
  border: 1px solid #2a2a2a;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
}
.ui-lang-select:hover { background: #1a1a1a; color: #e2e8f0; }
.ui-lang-select:focus-visible { outline: 2px solid #1f8f7a; outline-offset: 1px; }
</style>
```

A `<select>` rather than a two-way toggle: it stays correct when a third locale is added to the registry, and `selectOption()` gives the spec a stable handle.

- [ ] **Step 6: Mount it in the sidebar footer**

In `app/src/components/admin/AdminLayout.vue`, add the import beside the existing ones:

```ts
import UiLangSwitcher from './UiLangSwitcher.vue'
```

and place the component as the first child of `.sidebar-footer`, immediately above `<div v-if="user" class="sidebar-user">`:

```html
      <div class="sidebar-footer">
        <UiLangSwitcher />
        <div v-if="user" class="sidebar-user">
```

- [ ] **Step 7: Move the `<html lang>` watcher onto the chrome axis**

In `app/src/App.vue`, replace the `useLang` import and its watcher. Before:

```ts
import { useLang } from '@/composables/useLang'

const route = useRoute()
const { lang } = useLang()

// Keep <html lang> in sync with the active locale (WCAG 3.1.1)
watch(lang, (l) => { document.documentElement.lang = l }, { immediate: true })
```

After:

```ts
import { useUiLang } from '@/composables/useUiLang'

const route = useRoute()
const { uiLang } = useUiLang()

// Keep <html lang> in sync with the language the chrome is rendered in
// (WCAG 3.1.1). Deliberately the UI axis, not the content axis: an editor
// proofreading Polish copy in an English panel is reading an English page.
watch(uiLang, (l) => { document.documentElement.lang = l }, { immediate: true })
```

**Delete the now-unused `useLang` import.** `tsconfig.app.json` sets `noUnusedLocals`, and this repo has already broken a `main` deploy on exactly that (`TS6133`) because the PR-level check never ran the real build.

- [ ] **Step 8: Type-check, then run the E2E spec**

```bash
cd app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
pnpm exec playwright test e2e/tests/admin/ui-language.spec.ts --project=chromium
```

Expected: build PASS. E2E still **FAILS** on `toContainText('Pulpit')` — the nav is not translated until Task 4. That is correct and expected; the switcher, persistence and `<html lang>` assertions must already pass. Confirm the failure names `Pulpit` and nothing else.

- [ ] **Step 9: Commit**

```bash
git add app/src/composables/useUiLang.ts app/src/components/admin/UiLangSwitcher.vue \
        app/src/components/admin/AdminLayout.vue app/src/App.vue app/src/i18n app/e2e/tests/admin/ui-language.spec.ts
git commit -m "Admin i18n: chrome-language switcher in the sidebar

Stores under admin_ui_lang, separate from the content axis's site_lang.
App.vue's <html lang> watcher moves onto the chrome axis — it previously
announced the page as Polish whenever an editor was proofreading Polish copy.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The shell — sidebar nav, roles, sign-in

**Files:**
- Modify: `app/src/i18n/en/shell.ts`, `app/src/i18n/pl/shell.ts`
- Modify: `app/src/components/admin/AdminLayout.vue` (nav text nodes + role badge)
- Modify: `app/src/views/admin/AdminEntry.vue`, `app/src/components/auth/SignInForm.vue`, `app/src/App.vue` (skip link)

**Interfaces:**
- Consumes: `shell.uiLang.*` (Task 3).
- Produces: message keys `shell.nav.*`, `shell.groups.*`, `shell.roles.*`, `shell.signIn.*`, `shell.skipLink`.

- [ ] **Step 1: Extend the English shell catalogue**

Replace `app/src/i18n/en/shell.ts` with the full set. Every string is verbatim from `AdminLayout.vue`, `AdminEntry.vue`, `SignInForm.vue` and `App.vue`:

```ts
export default {
  uiLang: {
    label: 'Panel language',
  },
  brand: {
    subtitle: 'Admin',
  },
  skipLink: 'Skip to main content',
  groups: {
    band: 'Your Band',
    content: 'Content',
    shows: 'Shows',
    more: 'Settings',
    pageconfig: 'Page Configuration',
  },
  nav: {
    dashboard: 'Dashboard',
    myProfile: 'My Profile',
    mySetups: 'My Stage Setups',
    bandProfile: 'Band Profile',
    bandMembers: 'Band Members',
    releases: 'Releases',
    musicVideos: 'Music Videos',
    clips: 'Clips',
    photos: 'Photos',
    bandCalendar: 'Band Calendar',
    techRider: 'Tech Rider',
    setlists: 'Setlists',
    posts: 'Posts',
    press: 'Press',
    pitch: 'Pitch Generator',
    newsletter: 'Newsletter',
    authors: 'Authors & Contacts',
    concerts: 'Concerts',
    tours: 'Tours',
    venues: 'Venues',
    door: 'Door Check',
    shop: 'Shop',
    bands: 'Other Bands',
    tags: 'Tags',
    instruments: 'Instruments',
    users: 'Users',
    websiteModules: 'Website Modules',
    faqs: 'FAQ',
    heroImages: 'Hero Images',
  },
  roles: {
    admin: 'admin',
    member: 'member',
    publisher: 'publisher',
  },
  signOut: 'Sign out',
  signIn: {
    heading: 'Sign In',
    email: 'Email',
    emailPlaceholder: 'your@email.com',
    password: 'Password',
    submit: 'Sign In',
    submitting: 'Signing in…',
  },
}
```

- [ ] **Step 2: Extend the Polish shell catalogue**

Replace `app/src/i18n/pl/shell.ts`:

```ts
export default {
  uiLang: {
    label: 'Język panelu',
  },
  brand: {
    subtitle: 'Panel',
  },
  skipLink: 'Przejdź do treści',
  groups: {
    band: 'Twój zespół',
    content: 'Treści',
    shows: 'Koncerty',
    more: 'Ustawienia',
    pageconfig: 'Konfiguracja strony',
  },
  nav: {
    dashboard: 'Pulpit',
    myProfile: 'Mój profil',
    mySetups: 'Moje zestawy sceniczne',
    bandProfile: 'Profil zespołu',
    bandMembers: 'Skład zespołu',
    releases: 'Wydawnictwa',
    musicVideos: 'Teledyski',
    clips: 'Klipy',
    photos: 'Zdjęcia',
    bandCalendar: 'Kalendarz zespołu',
    techRider: 'Rider techniczny',
    setlists: 'Setlisty',
    posts: 'Aktualności',
    press: 'Prasa',
    pitch: 'Generator ofert',
    newsletter: 'Newsletter',
    authors: 'Autorzy i kontakty',
    concerts: 'Koncerty',
    tours: 'Trasy',
    venues: 'Miejsca',
    door: 'Kontrola biletów',
    shop: 'Sklep',
    bands: 'Inne zespoły',
    tags: 'Tagi',
    instruments: 'Instrumenty',
    users: 'Użytkownicy',
    websiteModules: 'Moduły strony',
    faqs: 'FAQ',
    heroImages: 'Zdjęcia nagłówkowe',
  },
  roles: {
    admin: 'administrator',
    member: 'muzyk',
    publisher: 'redaktor',
  },
  signOut: 'Wyloguj',
  signIn: {
    heading: 'Zaloguj się',
    email: 'E-mail',
    emailPlaceholder: 'twoj@email.pl',
    password: 'Hasło',
    submit: 'Zaloguj się',
    submitting: 'Logowanie…',
  },
}
```

- [ ] **Step 3: Replace the nav text in `AdminLayout.vue`**

`globalInjection: true` is set, so `$t()` is available in templates with no import. Replace each bare text node. The five accordion headers:

```html
              {{ $t('shell.groups.band') }}
              {{ $t('shell.groups.content') }}
              {{ $t('shell.groups.shows') }}
              {{ $t('shell.groups.more') }}
              {{ $t('shell.groups.pageconfig') }}
```

The 29 `RouterLink` labels, each replacing the bare word after its `<svg>`, e.g.:

```html
        <RouterLink :to="adminUrl()" class="nav-item" exact-active-class="nav-item--active">
          <svg class="nav-icon" …/>
          {{ $t('shell.nav.dashboard') }}
        </RouterLink>
```

Map, in template order: `Dashboard`→`nav.dashboard`, `My Profile`→`nav.myProfile`, `My Stage Setups`→`nav.mySetups`, `Band Profile`→`nav.bandProfile`, `Band Members`→`nav.bandMembers`, `Releases`→`nav.releases`, `Music Videos`→`nav.musicVideos`, `Clips`→`nav.clips`, `Photos`→`nav.photos`, `Band Calendar`→`nav.bandCalendar`, `Tech Rider`→`nav.techRider`, `Setlists`→`nav.setlists`, `Posts`→`nav.posts`, `Press`→`nav.press`, `Pitch Generator`→`nav.pitch`, `Newsletter`→`nav.newsletter`, `Authors & Contacts`→`nav.authors`, `Concerts`→`nav.concerts`, `Tours`→`nav.tours`, `Venues`→`nav.venues`, `Door Check`→`nav.door`, `Shop`→`nav.shop`, `Other Bands`→`nav.bands`, `Tags`→`nav.tags`, `Instruments`→`nav.instruments`, `Users`→`nav.users`, `Website Modules`→`nav.websiteModules`, `FAQ`→`nav.faqs`, `Hero Images`→`nav.heroImages`.

The logo block, footer and role badge:

```html
        <div class="logo-sub">{{ $t('shell.brand.subtitle') }}</div>
```

```html
            <div class="user-role">{{ $t(`shell.roles.${user.role}`) }}</div>
```

```html
          {{ $t('shell.signOut') }}
```

`<span class="logo-band">Band</span><span class="logo-ms">MS</span>` is the product wordmark and stays literal — append `i18n-ignore` to each of those two lines so Task 7's lint accepts them.

- [ ] **Step 4: Translate the sign-in surface**

In `app/src/views/admin/AdminEntry.vue`:

```html
      <p class="mb-6 text-center text-sm font-semibold tracking-widest uppercase" style="color:#555555;">BandMS</p> <!-- i18n-ignore -->
      <div class="table-card px-8 py-8">
        <h1 class="mb-6 text-base font-semibold" style="color:#e2e8f0;">{{ $t('shell.signIn.heading') }}</h1>
```

In `app/src/components/auth/SignInForm.vue`:

```html
      <label class="field-label" for="signin-email">{{ $t('shell.signIn.email') }}</label>
```
```html
        :placeholder="$t('shell.signIn.emailPlaceholder')"
```
```html
      <label class="field-label" for="signin-password">{{ $t('shell.signIn.password') }}</label>
```
```html
      {{ loading ? $t('shell.signIn.submitting') : $t('shell.signIn.submit') }}
```

The password field's `placeholder="••••••••"` is punctuation, not language — leave it and append `i18n-ignore` to that line.

In `app/src/App.vue`:

```html
  <a href="#main-content" class="skip-link">{{ $t('shell.skipLink') }}</a>
```

> This one line also renders on the three non-admin SPA views, which are out of scope. A fan never sees the switcher, so their `admin_ui_lang` stays unset and they get English — the status quo. Recorded so the seam is deliberate.

- [ ] **Step 5: Verify the build and the full spec**

```bash
cd app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
pnpm exec playwright test e2e/tests/admin/ui-language.spec.ts --project=chromium
```

Expected: build PASS; **both E2E tests now PASS** — this is the task that makes Task 3's spec go green.

- [ ] **Step 6: Prove the English output did not drift**

The suite has ~178 specs asserting English chrome. Run the two that touch the shell hardest:

```bash
cd app && pnpm exec playwright test e2e/tests/admin/auth.spec.ts e2e/tests/admin/dashboard.spec.ts --project=chromium
```

Expected: PASS. A failure here means an English string changed during migration — fix the catalogue to match the original text exactly, do not edit the spec.

- [ ] **Step 7: Commit**

```bash
git add app/src/i18n app/src/components/admin/AdminLayout.vue app/src/views/admin/AdminEntry.vue \
        app/src/components/auth/SignInForm.vue app/src/App.vue
git commit -m "Admin i18n: sidebar nav, role badge and the sign-in form

English strings are copied verbatim so the ~178 specs asserting them stay
green; the default locale is unchanged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Shared chrome components

**Files:**
- Modify: `app/src/config/rebuildAreas.ts`, `app/src/config/rebuildAreas.spec.ts`
- Modify: `app/src/components/admin/AdminModal.vue`, `ConfirmDialog.vue`, `Pagination.vue`, `TableToolbar.vue`, `RebuildBar.vue`, `RebuildSettingsModal.vue`

**Interfaces:**
- Consumes: `common.*` (Task 2).
- Produces: `rebuildAreaMessageKey(area: string): string | null` replacing `rebuildAreaLabel`.

`SortHeader.vue` is deliberately **not** in this list: its only text comes from a `label` prop supplied by callers, and `aria-sort` takes HTML enum values. It needs no change in any PR.

- [ ] **Step 1: Rewrite the failing `rebuildAreas` spec**

The label map moves into the catalogue, so the util returns a *key* instead. Replace `app/src/config/rebuildAreas.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rebuildAreaMessageKey } from './rebuildAreas'

describe('rebuildAreaMessageKey', () => {
  it('returns the catalogue key for a known area', () => {
    expect(rebuildAreaMessageKey('concerts')).toBe('common.rebuildAreas.concerts')
  })

  it('handles a hyphenated area key', () => {
    expect(rebuildAreaMessageKey('music-videos')).toBe('common.rebuildAreas.music-videos')
  })

  // null, not the raw key: the caller decides how an unmapped area degrades,
  // and returning a key that does not exist would render the key itself.
  it('returns null for an unmapped area', () => {
    expect(rebuildAreaMessageKey('some-new-area')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd app && pnpm vitest run src/config/rebuildAreas.spec.ts
```

Expected: FAIL — `rebuildAreaMessageKey is not a function`.

- [ ] **Step 3: Rewrite the util**

Replace `app/src/config/rebuildAreas.ts`:

```ts
/**
 * Frontend half of the area-key registry — the backend half lives in
 * api/app/Support/SiteRebuild.php's call sites. The two are not auto-synced
 * (same convention as the locale registry in src/locales.ts): adding an area
 * means updating both, plus common.rebuildAreas in the i18n catalogues.
 */
export const REBUILD_AREAS = [
  'band-profile',
  'band-members',
  'hero-images',
  'posts',
  'website-modules',
  'concerts',
  'venues',
  'setlists',
  'releases',
  'photos',
  'music-videos',
  'press-releases',
  'shop',
  'faqs',
] as const

/**
 * The catalogue key for an area, or null when the area has no mapping.
 *
 * Null rather than the raw key so a forgotten mapping degrades in the caller
 * (which prints the raw area) instead of rendering "common.rebuildAreas.x".
 */
export function rebuildAreaMessageKey(area: string): string | null {
  return (REBUILD_AREAS as readonly string[]).includes(area)
    ? `common.rebuildAreas.${area}`
    : null
}
```

- [ ] **Step 4: Run the spec and confirm it passes**

```bash
cd app && pnpm vitest run src/config/rebuildAreas.spec.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Translate `AdminModal.vue`**

Only the close button is hardcoded (`title` is a prop). In the template:

```html
            <button @click="$emit('close')" class="modal-close" :aria-label="$t('common.actions.close')">
```

- [ ] **Step 6: Translate `ConfirmDialog.vue`**

```html
            <h3 id="confirm-dialog-title" class="text-sm font-semibold" style="color:#e2e8f0;">{{ $t('common.confirm.deleteTitle') }}</h3>
```
```html
          <p class="text-sm mb-5 leading-relaxed" style="color:#94a3b8;">{{ message ?? $t('common.confirm.deleteMessage') }}</p>
```
```html
            <button @click="$emit('cancel')" :disabled="loading" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
            <button @click="$emit('confirm')" :disabled="loading" class="btn-danger">
              {{ loading ? $t('common.actions.deleting') : $t('common.actions.delete') }}
            </button>
```

The `message` prop keeps precedence — callers pass their own wording, which their own area PR will translate.

- [ ] **Step 7: Translate `Pagination.vue`**

```html
  <div class="pg" role="navigation" :aria-label="$t('common.pagination.label')">
    <span class="pg-info">{{ $t('common.pagination.range', { from, to, total }) }}</span>
```
```html
      <button class="pg-btn" :disabled="page <= 1" :aria-label="$t('common.pagination.previous')" @click="go(page - 1)">
```
```html
      <button class="pg-btn" :disabled="page >= totalPages" :aria-label="$t('common.pagination.next')" @click="go(page + 1)">
```

`{{ from }}–{{ to }} of {{ total }}` becomes one interpolated message. The en-dash is inside the message, and the rendered English is unchanged.

- [ ] **Step 8: Translate `TableToolbar.vue`**

```html
        :placeholder="$t('common.table.searchPlaceholder')"
```
```html
        :aria-label="$t('common.table.searchLabel')"
```

- [ ] **Step 9: Translate `RebuildBar.vue`**

Add to `<script setup>`:

```ts
import { useI18n } from 'vue-i18n'
import { rebuildAreaMessageKey } from '@/config/rebuildAreas'

const { t } = useI18n()

function areaLabel(area: string): string {
  const key = rebuildAreaMessageKey(area)
  return key ? t(key) : area
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return t('common.time.justNow')
  if (minutes < 60) return t('common.time.minutesAgo', { n: minutes })
  return t('common.time.hoursAgo', { n: Math.floor(minutes / 60) })
}
```

Remove the old `rebuildAreaLabel` import — `noUnusedLocals` will fail the build otherwise.

Template changes:

```html
        <span class="pending-count">{{ pendingAreas.length }}</span>
        {{ $t('common.rebuild.pendingChanges', pendingAreas.length) }}
```
```html
          <span>{{ areaLabel(item.area) }}</span>
```
```html
      :title="autoRebuild ? $t('common.rebuild.autoActive') : $t('common.rebuild.rebuildTitle')"
```
```html
      {{ isBuilding ? $t('common.rebuild.rebuilding') : $t('common.rebuild.rebuild') }}
```
```html
    <button type="button" class="btn-settings" :title="$t('common.rebuild.settingsTitle')" @click="showSettings = true">
      ⚙ <!-- i18n-ignore -->
    </button>
```

**English plural output must not drift.** vue-i18n's default rule for a two-choice message is `choice === 1 ? 0 : 1`, so `0`→"pending changes", `1`→"pending change", `2`→"pending changes" — byte-identical to the old `length === 1 ? '' : 's'`. Polish supplies three choices and `pluralRules.pl` picks among them.

- [ ] **Step 10: Translate `RebuildSettingsModal.vue`**

Open the file, replace each bare text node and hardcoded `placeholder`/`aria-label`/`title` with a `$t('common.rebuild.*')` call, adding the key to **both** `en/common.ts` and `pl/common.ts` as you go. The file is 87 lines; `pnpm build` will name any key you add to English and forget in Polish.

- [ ] **Step 11: Verify**

```bash
cd app && pnpm vitest run
rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
pnpm exec playwright test e2e/tests/admin/rebuild-bar.spec.ts e2e/tests/admin/tags.spec.ts --project=chromium
```

Expected: vitest PASS with the count **up by 1** on the previous run (the third `rebuildAreas` case); build PASS; both specs PASS. `rebuild-bar.spec.ts` is the direct English-drift check for this task.

- [ ] **Step 12: Commit**

```bash
git add app/src/config/rebuildAreas.ts app/src/config/rebuildAreas.spec.ts app/src/components/admin app/src/i18n
git commit -m "Admin i18n: modal, confirm, pagination, toolbar and rebuild bar

rebuildAreaLabel becomes rebuildAreaMessageKey, returning a catalogue key or
null so the caller still decides how an unmapped area degrades. The pending
plural keeps its exact English output.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Dashboard and EPK version history

**Files:**
- Create: `app/src/i18n/en/dashboard.ts`, `app/src/i18n/pl/dashboard.ts`
- Modify: `app/src/i18n/en/index.ts`, `app/src/i18n/pl/index.ts`
- Modify: `app/src/views/admin/AdminDashboard.vue`, `app/src/components/admin/EpkVersionHistory.vue`

**Interfaces:**
- Consumes: `common.*`, `shell.*`.
- Produces: message keys `dashboard.*`.

- [ ] **Step 1: Write the English dashboard catalogue**

Create `app/src/i18n/en/dashboard.ts`:

```ts
export default {
  welcome: 'Welcome back',
  welcomeNamed: 'Welcome back, {name}',
  subtitle: 'BandMS Admin Panel — manage all your content below.',
  stats: {
    bands: 'Bands',
    releases: 'Releases',
    tours: 'Tours',
    venues: 'Venues',
    concerts: 'Concerts',
    tags: 'Tags',
  },
  epk: {
    title: 'EPK Versions',
    live: 'Live: v{version} ({date})',
    none: 'No published version — EPK shows live data',
    allVersions: 'All versions',
    createSnapshot: 'Create snapshot →',
    pendingBadge: 'Pending review',
    publish: 'Publish',
    publishing: 'Publishing…',
    discard: 'Discard',
    noPendingPrefix: 'No pending snapshot. Go to',
    noPendingLink: 'Band Profile → EPK',
    noPendingSuffix: 'to create one.',
    historyTitle: 'EPK version history',
    loading: 'Loading…',
    loadError: 'Could not load the version history. Try again in a moment.',
    empty: 'No snapshots yet. Until one is published, {code} shows the live profile data — create a snapshot from Band Profile → EPK.',
    status: {
      published: 'Live',
      pending: 'Pending',
      archived: 'Archived',
    },
    created: 'created {date}',
    makeLive: 'Make live',
    delete: 'Delete',
    confirmDiscard: 'Discard this draft? Nothing has been published from it.',
  },
  career: {
    title: 'Band Career Level',
  },
  enhance: {
    title: 'Press Coverage Enhance Level',
    subtitle: 'Enrich each article with tags, concerts, releases and authors to increase score.',
    lowest: 'Lowest-scoring articles — click to improve:',
  },
  quickActions: {
    title: 'Quick actions',
    band: '+ Band',
    venue: '+ Venue',
    concert: '+ Concert',
    post: '+ Post',
    release: '+ Release',
    tour: '+ Tour',
    photo: '+ Photo',
    video: '+ Video',
  },
  tickets: {
    title: 'Tickets',
    total: 'Total',
    active: 'Active',
    transferred: 'Transferred',
    scanned: 'Scanned',
  },
}
```

- [ ] **Step 2: Write the Polish dashboard catalogue**

Create `app/src/i18n/pl/dashboard.ts`:

```ts
export default {
  welcome: 'Witaj ponownie',
  welcomeNamed: 'Witaj ponownie, {name}',
  subtitle: 'Panel administracyjny BandMS — zarządzaj wszystkimi treściami poniżej.',
  stats: {
    bands: 'Zespoły',
    releases: 'Wydawnictwa',
    tours: 'Trasy',
    venues: 'Miejsca',
    concerts: 'Koncerty',
    tags: 'Tagi',
  },
  epk: {
    title: 'Wersje EPK',
    live: 'Na żywo: v{version} ({date})',
    none: 'Brak opublikowanej wersji — EPK pokazuje dane na żywo',
    allVersions: 'Wszystkie wersje',
    createSnapshot: 'Utwórz migawkę →',
    pendingBadge: 'Oczekuje na przegląd',
    publish: 'Opublikuj',
    publishing: 'Publikowanie…',
    discard: 'Odrzuć',
    noPendingPrefix: 'Brak oczekującej migawki. Przejdź do',
    noPendingLink: 'Profil zespołu → EPK',
    noPendingSuffix: 'aby ją utworzyć.',
    historyTitle: 'Historia wersji EPK',
    loading: 'Ładowanie…',
    loadError: 'Nie udało się wczytać historii wersji. Spróbuj ponownie za chwilę.',
    empty: 'Brak migawek. Dopóki żadna nie zostanie opublikowana, {code} pokazuje dane profilu na żywo — utwórz migawkę w Profil zespołu → EPK.',
    status: {
      published: 'Na żywo',
      pending: 'Oczekująca',
      archived: 'Zarchiwizowana',
    },
    created: 'utworzono {date}',
    makeLive: 'Ustaw jako aktualną',
    delete: 'Usuń',
    confirmDiscard: 'Odrzucić ten szkic? Nic z niego nie zostało opublikowane.',
  },
  career: {
    title: 'Poziom kariery zespołu',
  },
  enhance: {
    title: 'Poziom wzbogacenia materiałów prasowych',
    subtitle: 'Wzbogać każdy artykuł o tagi, koncerty, wydawnictwa i autorów, aby podnieść wynik.',
    lowest: 'Artykuły z najniższym wynikiem — kliknij, aby poprawić:',
  },
  quickActions: {
    title: 'Szybkie akcje',
    band: '+ Zespół',
    venue: '+ Miejsce',
    concert: '+ Koncert',
    post: '+ Wpis',
    release: '+ Wydawnictwo',
    tour: '+ Trasa',
    photo: '+ Zdjęcie',
    video: '+ Teledysk',
  },
  tickets: {
    title: 'Bilety',
    total: 'Razem',
    active: 'Aktywne',
    transferred: 'Przekazane',
    scanned: 'Zeskanowane',
  },
}
```

- [ ] **Step 3: Register in both barrels**

`app/src/i18n/en/index.ts`:

```ts
import common from './common'
import dashboard from './dashboard'
import shell from './shell'

export default { common, dashboard, shell }
```

`app/src/i18n/pl/index.ts`:

```ts
import type { MessageSchema } from '../schema'
import common from './common'
import dashboard from './dashboard'
import shell from './shell'

const pl: MessageSchema = { common, dashboard, shell }

export default pl
```

- [ ] **Step 4: Translate `AdminDashboard.vue` — the stat labels**

The `stats` and `statCards` arrays hold display strings in `<script setup>`. They must become keys resolved at render, or they will not re-render on a language switch. Add `const { t } = useI18n()` (importing `useI18n` from `vue-i18n`) and make both arrays `computed`, replacing each literal:

```ts
{ label: t('dashboard.stats.bands'), count: bandsQ.data.value?.length, link: adminUrl('bands'), color: '#c0c0c0' },
{ label: t('dashboard.stats.releases'), count: releasesQ.data.value?.length, link: adminUrl('releases'), color: '#f472b6' },
{ label: t('dashboard.stats.tours'), count: toursQ.data.value?.length, link: adminUrl('tours'), color: '#fbbf24' },
{ label: t('dashboard.stats.venues'), count: venuesQ.data.value?.length, link: adminUrl('venues'), color: '#34d399' },
{ label: t('dashboard.stats.concerts'), count: concertsQ.data.value?.length, link: adminUrl('concerts'), color: '#fb923c' },
{ label: t('dashboard.stats.tags'), count: tagsQ.data.value?.length, link: adminUrl('tags'), color: '#22d3ee' },
```

and for `statCards`:

```ts
{ label: t('dashboard.tickets.total'), value: ticketStats.value.total },
{ label: t('dashboard.tickets.active'), value: ticketStats.value.active },
{ label: t('dashboard.tickets.transferred'), value: ticketStats.value.transferred },
{ label: t('dashboard.tickets.scanned'), value: ticketStats.value.scanned },
```

Both `v-for` loops use `:key="s.label"`, which stays valid — the labels remain unique within a locale.

- [ ] **Step 5: Translate the `AdminDashboard.vue` template**

```html
        <h1 class="text-xl font-bold mb-1" style="color:#e2e8f0;">
          {{ user ? $t('dashboard.welcomeNamed', { name: user.first_name }) : $t('dashboard.welcome') }}
        </h1>
        <p class="text-sm" style="color:#64748b;">{{ $t('dashboard.subtitle') }}</p>
```

The original splits the name into a `<span>`; one interpolated message replaces both branches and renders the same text.

EPK widget:

```html
            <div class="readiness-title">{{ $t('dashboard.epk.title') }}</div>
            <div class="readiness-sub">
              <span v-if="publishedVersion">{{ $t('dashboard.epk.live', { version: publishedVersion.version_number, date: publishedVersion.published_at?.slice(0,10) }) }}</span>
              <span v-else style="color:#f87171;">{{ $t('dashboard.epk.none') }}</span>
            </div>
```
```html
            <button type="button" class="epk-create-link" @click="epk.open.value = true">{{ $t('dashboard.epk.allVersions') }}</button>
            <RouterLink :to="adminUrl('band-profile')" class="epk-create-link">{{ $t('dashboard.epk.createSnapshot') }}</RouterLink>
```
```html
          <div class="epk-pending-badge">{{ $t('dashboard.epk.pendingBadge') }}</div>
```
```html
            >{{ epk.publishing.value ? $t('dashboard.epk.publishing') : $t('dashboard.epk.publish') }}</button>
```
```html
            >{{ $t('dashboard.epk.discard') }}</button>
```
```html
        <div v-else class="epk-no-pending">
          {{ $t('dashboard.epk.noPendingPrefix') }} <RouterLink :to="adminUrl('band-profile')" style="color:#c0c0c0;">{{ $t('dashboard.epk.noPendingLink') }}</RouterLink> {{ $t('dashboard.epk.noPendingSuffix') }}
        </div>
```

Career, enhance, quick actions and tickets:

```html
        <div class="readiness-title mb-2">{{ $t('dashboard.career.title') }}</div>
```
```html
            <div class="readiness-title">{{ $t('dashboard.enhance.title') }}</div>
            <div class="readiness-sub">{{ $t('dashboard.enhance.subtitle') }}</div>
```
```html
        <div class="enhance-sub">{{ $t('dashboard.enhance.lowest') }}</div>
```
```html
        <h2 class="text-xs font-semibold uppercase tracking-wider mb-3" style="color:#475569;">{{ $t('dashboard.quickActions.title') }}</h2>
        <div class="flex flex-wrap gap-2">
          <RouterLink :to="adminUrl('bands')" class="quick-btn">{{ $t('dashboard.quickActions.band') }}</RouterLink>
          <RouterLink :to="adminUrl('venues')" class="quick-btn">{{ $t('dashboard.quickActions.venue') }}</RouterLink>
          <RouterLink :to="adminUrl('concerts')" class="quick-btn">{{ $t('dashboard.quickActions.concert') }}</RouterLink>
          <RouterLink :to="adminUrl('posts')" class="quick-btn">{{ $t('dashboard.quickActions.post') }}</RouterLink>
          <RouterLink :to="adminUrl('releases')" class="quick-btn">{{ $t('dashboard.quickActions.release') }}</RouterLink>
          <RouterLink :to="adminUrl('tours')" class="quick-btn">{{ $t('dashboard.quickActions.tour') }}</RouterLink>
          <RouterLink :to="adminUrl('photos')" class="quick-btn">{{ $t('dashboard.quickActions.photo') }}</RouterLink>
          <RouterLink :to="adminUrl('music-videos')" class="quick-btn">{{ $t('dashboard.quickActions.video') }}</RouterLink>
        </div>
```
```html
        <h2 class="text-lg font-semibold mb-3" style="color:#e2e8f0;">{{ $t('dashboard.tickets.title') }}</h2>
```

- [ ] **Step 6: Translate `EpkVersionHistory.vue`**

In `<script setup>`, replace the `STATUS_LABEL` constant with a key map and make `formatDate` locale-aware:

```ts
import { useI18n } from 'vue-i18n'
import { useUiLang } from '@/composables/useUiLang'

const { t } = useI18n()
const { uiLang } = useUiLang()

const STATUS_KEY: Record<EpkVersionStatus, string> = {
  published: 'dashboard.epk.status.published',
  pending:   'dashboard.epk.status.pending',
  archived:  'dashboard.epk.status.archived',
}

function statusLabel(status: EpkVersionStatus): string {
  return t(STATUS_KEY[status])
}

// Month names follow the chrome language, not the browser's. `undefined` here
// used to mean "whatever the OS says", which could print a Polish month in an
// English panel.
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(uiLang.value, { day: 'numeric', month: 'short', year: 'numeric' })
}
```

Template:

```html
  <AdminModal :open="open" :title="$t('dashboard.epk.historyTitle')" max-width="36rem" @close="emit('close')">
```
```html
      <p v-if="loading" class="empty">{{ $t('dashboard.epk.loading') }}</p>

      <p v-else-if="error" class="empty empty--error">
        {{ $t('dashboard.epk.loadError') }}
      </p>

      <p v-else-if="!versions.length" class="empty">
        {{ $t('dashboard.epk.empty', { code: '/epk' }) }}
      </p>
```
```html
              >{{ statusLabel(version.status) }}</span>
```
```html
              <span class="version-date">
                {{ version.status === 'pending' ? $t('dashboard.epk.created', { date: formatDate(version.created_at) }) : formatDate(version.published_at) }}
              </span>
```
```html
            >{{ version.status === 'pending' ? $t('dashboard.epk.publish') : $t('dashboard.epk.makeLive') }}</button>
```
```html
            >{{ version.status === 'pending' ? $t('dashboard.epk.discard') : $t('dashboard.epk.delete') }}</button>
```
```html
              <template v-if="version.status === 'pending'">
                {{ $t('dashboard.epk.confirmDiscard') }}
              </template>
```

Then open the remainder of the template (past line 58) and replace any bare text node still there, adding each key to **both** catalogues.

> The `<code>/epk</code>` element in the empty state becomes a `{code}` parameter, which renders as plain text rather than a `<code>` tag. That is a deliberate, tiny visual change — interpolating markup would mean `v-html`, and the EPK version list is not worth an XSS surface.

- [ ] **Step 7: Verify, including the chained EPK projects**

```bash
cd app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
pnpm exec playwright test e2e/tests/admin/dashboard.spec.ts --project=chromium
pnpm exec playwright test e2e/tests/admin/epk-versions.spec.ts --project=epk-admin
```

Expected: all PASS. `epk-versions.spec.ts` asserts on `data-testid="epk-version-status"` text, so it is the direct check that the status labels still read `Live` / `Pending` / `Archived` in English. It publishes EPK versions for real — run it under `--project=epk-admin`, never in the `chromium` pool.

- [ ] **Step 8: Commit**

```bash
git add app/src/i18n app/src/views/admin/AdminDashboard.vue app/src/components/admin/EpkVersionHistory.vue
git commit -m "Admin i18n: dashboard and EPK version history

Stat labels move into computed arrays so they re-render on a language switch.
EPK dates now format against the chrome locale instead of the browser's.
CareerLevelWidget stays English until PR 4.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The guardrail lint, and full verification

**Files:**
- Create: `app/scripts/check-admin-strings.mjs`
- Modify: `app/package.json` (the `build` script)

**Interfaces:**
- Consumes: nothing at runtime.
- Produces: a `MIGRATED` array that PRs 2–6 extend, one entry per translated area.

- [ ] **Step 1: Write the lint**

Create `app/scripts/check-admin-strings.mjs`:

```js
#!/usr/bin/env node
/**
 * Stops a translated area regressing to hardcoded English.
 *
 * Scoped to MIGRATED rather than all of src/, because PRs 2-6 have not run
 * yet. Each area PR appends its paths, which makes the sweep a one-way
 * ratchet: a view cannot quietly go back to literals once it has been done.
 *
 * This is a ratchet, not a proof. It reads templates with regexes, not the Vue
 * compiler's AST, so it will miss exotic shapes. Append `i18n-ignore` to a line
 * whose text is genuinely fixed — a wordmark, a glyph, punctuation.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

/** Paths already migrated, relative to app/src. Extend this in every area PR. */
const MIGRATED = [
  'App.vue',
  'components/admin/AdminLayout.vue',
  'components/admin/AdminModal.vue',
  'components/admin/ConfirmDialog.vue',
  'components/admin/EpkVersionHistory.vue',
  'components/admin/Pagination.vue',
  'components/admin/RebuildBar.vue',
  'components/admin/RebuildSettingsModal.vue',
  'components/admin/SortHeader.vue',
  'components/admin/TableToolbar.vue',
  'components/admin/UiLangSwitcher.vue',
  'components/auth/SignInForm.vue',
  'views/admin/AdminDashboard.vue',
  'views/admin/AdminEntry.vue',
]

const ATTRS = /(?<!:)\b(?:placeholder|aria-label|title)="([^"]*)"/g
const HAS_WORDS = /[A-Za-zÀ-ž]{2,}/

function templateOf(src) {
  const start = src.indexOf('<template>')
  const end = src.lastIndexOf('</template>')
  return start === -1 || end === -1 ? '' : src.slice(start, end)
}

/** Text between tags, with mustaches and HTML comments removed. */
function bareText(line) {
  const hits = []
  const stripped = line.replace(/\{\{[^}]*\}\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
  for (const m of stripped.matchAll(/>([^<>]+)</g)) {
    const text = m[1].trim()
    if (HAS_WORDS.test(text)) hits.push(text)
  }
  return hits
}

function attrText(line) {
  const hits = []
  for (const m of line.matchAll(ATTRS)) {
    if (HAS_WORDS.test(m[1])) hits.push(m[0])
  }
  return hits
}

function filesFor(entry) {
  const abs = join(ROOT, 'src', entry)
  if (!statSync(abs).isDirectory()) return [abs]
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.vue')) out.push(p)
    }
  }
  walk(abs)
  return out
}

const violations = []

for (const entry of MIGRATED) {
  for (const file of filesFor(entry)) {
    const tpl = templateOf(readFileSync(file, 'utf8'))
    if (!tpl) continue

    tpl.split('\n').forEach((line, i) => {
      if (line.includes('i18n-ignore')) return
      const hits = [...bareText(line), ...attrText(line)]
      if (hits.length) {
        violations.push({
          file: relative(ROOT, file).split(sep).join('/'),
          line: i + 1,
          hits: [...new Set(hits)].join(' | '),
        })
      }
    })
  }
}

if (violations.length === 0) {
  console.log(`✓ admin strings: ${MIGRATED.length} migrated path(s), no hardcoded text`)
  process.exit(0)
}

console.error(`\n✗ admin strings: ${violations.length} hardcoded string(s) in migrated files\n`)
for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.hits}`)
console.error(`
Move the text into app/src/i18n/en/<area>.ts and its pl/ counterpart, then read
it with $t('<area>.<key>'). If the string is genuinely fixed — a wordmark, a
glyph, punctuation — append i18n-ignore to that line.
`)
process.exit(1)
```

Note the line-number caveat: indices count lines **from the opening `<template>`**, not from the top of the file. Good enough to locate a violation; do not treat it as a file offset.

- [ ] **Step 2: Run it and fix what it finds**

```bash
cd app && node scripts/check-admin-strings.mjs
```

Expected on first run: a short list of leftovers missed in Tasks 4–6. For each, either move the string into the catalogues (both locales) or append `i18n-ignore` if it is a wordmark/glyph. Re-run until it prints `✓`.

- [ ] **Step 3: Wire it into the build**

In `app/package.json`, change the `build` script:

```json
    "build": "node scripts/check-admin-strings.mjs && vue-tsc -b && vite build",
```

The lint runs first so a hardcoded string fails before the slower type-check. This is the same shape as `web`'s `"build": "node scripts/check-tokens.mjs && astro build"`, and it means CI's `Build & push images` job enforces it.

- [ ] **Step 4: Prove the lint actually bites**

```bash
cd app && node -e "const f='src/components/admin/ConfirmDialog.vue';const s=require('fs').readFileSync(f,'utf8');require('fs').writeFileSync(f,s.replace(\"{{ \$t('common.actions.cancel') }}\",'Cancel'))"
node scripts/check-admin-strings.mjs
```

Expected: **FAIL**, naming `ConfirmDialog.vue` and `Cancel`. Then restore:

```bash
cd app && git checkout src/components/admin/ConfirmDialog.vue && node scripts/check-admin-strings.mjs
```

Expected: `✓`. If the reverted string did not trip the lint, the regex or the `MIGRATED` entry is wrong — fix it now, because PRs 2–6 rely on this being real.

- [ ] **Step 5: Full verification**

```bash
cd app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
cd /c/Projects/bandms && bash scripts/test-all.sh
```

Expected: build PASS; `test-all.sh` exits **0**. It returns a bitmask — 1 backend, 2 E2E, 4 frontend — so a non-zero code names which suite failed.

If E2E is red, triage with the repo's order before touching code: a *different* set of specs failing each run, `[vite] http proxy error` / `ECONNRESET` in the log, `GPU process launch failed`, or 30-second timeouts rather than assertion mismatches all mean the machine, not this change. `grep -c ECONNRESET` on the run log first. A single spec that reproduces in isolation is a real failure.

- [ ] **Step 6: Rebuild the image**

```bash
cd /c/Projects/bandms && bash rebuild.sh
```

Required, not optional: the SPA is baked into the `frontend` image at build time, so `docker compose restart frontend` cannot show any of this. Confirm the panel loads at `http://localhost:8081/admin`, switch the language in the sidebar, reload, and confirm it stuck.

- [ ] **Step 7: Commit and open the PR**

```bash
git add app/scripts/check-admin-strings.mjs app/package.json app/src
git commit -m "Admin i18n: guardrail lint against hardcoded strings

Scoped to a MIGRATED path list that each area PR extends, so the sweep is a
one-way ratchet. Wired ahead of vue-tsc in the build, matching web's token lint.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin feature/admin-ui-language
gh pr create --fill
```

- [ ] **Step 8: Review before merging**

Run `/code-review` on the PR. `CLAUDE.md` is explicit that every PR gets an explicit review pass — `/ship`'s pipeline has no review step, and `git-feature-workflow`'s only runs `vue3-review` conditionally. Do not merge on green tests alone.

---

## Self-Review

**Spec coverage** — every section of the spec maps to a task:

| Spec section | Task |
|---|---|
| §1 i18n layer: library, files, schema typing, no fourth locale list, plural rule, message compiler | 2 (typing proven in 2.8), 1 (plural rule) |
| §2 switcher, `admin_ui_lang`, `<html lang>` owner | 3 |
| §3 catalogue organisation and key naming | 2, 4, 6 |
| §4 guardrail lint with `MIGRATED` ratchet | 7 |
| §5 rollout — PR 1 contents | 1–7 |
| §6 testing — E2E spec, `uiLocale.spec.ts`, `.spec.ts` naming, utils placement | 3 (E2E), 1 (unit) |
| §7 verification — clear tsbuildinfo, `pnpm build`, `test-all.sh`, `rebuild.sh` | 7.5, 7.6 |

**Deviation from the spec, recorded deliberately:** the spec listed `SortHeader` among PR 1's shared components. It has no hardcoded user-visible text — its `label` is a prop — so Task 5 notes it and changes nothing. It is still added to `MIGRATED` so the lint holds it to that.

**Type consistency:** `resolveStoredLocale` / `polishPluralIndex` / `UI_LANG_STORAGE_KEY` (Task 1) are consumed under those exact names in Tasks 2 and 3. `rebuildAreaMessageKey` replaces `rebuildAreaLabel` in Task 5 and is consumed only there. `useUiLang` returns `{ uiLang, setUiLang }`, used under those names in `UiLangSwitcher.vue`, `App.vue` and `EpkVersionHistory.vue`. Catalogue namespaces are `common`, `shell`, `dashboard` throughout, and both barrels list them in the same order.

**Known risk carried forward:** Task 5 Step 10 and Task 6 Step 6 ask the implementer to finish two files (`RebuildSettingsModal.vue`, the tail of `EpkVersionHistory.vue`) whose full text is not enumerated here. Both are bounded by a mechanical check rather than judgement — `pnpm build` fails on an English key with no Polish counterpart, and Task 7's lint fails on any string left behind — so neither can be silently half-done.
