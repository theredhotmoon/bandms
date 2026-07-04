# Language Selector — Full i18n Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flag+text language selector to the Astro public site footer, backed by full end-to-end i18n wiring: locale-prefixed URLs (`/en/…`, `/pl/…`), CMS-data fetched in the active locale, and CMS-driven URL slugs derived from module custom names.

**Architecture:** Astro's static i18n with `prefixDefaultLocale: true` generates both `/en/…` and `/pl/…` for every page. A build-time slug helper (`src/lib/slugs.ts`) calls `GET /api/site-config?lang=en` and `?lang=pl` to derive locale-specific URL segments from module custom names. Page routing uses dynamic `[lang]/[section].astro` and `[lang]/[section]/[slug].astro` catch-all files whose `getStaticPaths` uses the slug map. The `LanguageSelector.astro` component is zero-JS (pure Astro), placed in the footer.

**Tech Stack:** Astro 5 (SSG, static output), Vue 3 island components, TypeScript, TanStack-free (server-side data fetching only in `.astro` files), Tailwind CSS v4.

## Global Constraints

- `output: 'static'` — no SSR adapters; all data fetched at build time in `.astro` frontmatter.
- `prefixDefaultLocale: true` — all URLs have `/en/` or `/pl/` prefix after this change.
- Locales: `en` (English, default) and `pl` (Polish).
- No backend changes — existing `GET /api/site-config?lang=` already returns locale-specific labels via `SetLocale` middleware.
- No Vue-based language switching — `LanguageSelector.astro` ships zero JS.
- Vue island components (`ShowsArchiveFilter.vue`, `ShowsMap.vue`) must be updated to accept full hrefs instead of bare slugs (they currently hardcode `/concerts/`).
- `newsletter/confirm/`, `newsletter/unsubscribe/`, and `rider/` pages stay at root without locale prefix — they handle token-based backend actions and do not need localization.
- `about.astro` stays at root; it is not in the main nav and is out of scope.
- Run `make test` (backend Pest suite) after any backend-adjacent change and before any commit that touches the API layer.
- Feature branch: `feature/language-selector-i18n`.

---

## File Map

**Created:**
- `web/src/lib/slugs.ts` — build-time slug map helper
- `web/src/components/LanguageSelector.astro` — flag+text selector, zero JS
- `web/src/components/sections/ConcertsSection.astro` — concerts list (moved from `pages/concerts/index.astro`)
- `web/src/components/sections/ReleasesSection.astro` — releases list (from `pages/releases/index.astro`)
- `web/src/components/sections/PostsSection.astro` — posts list (from `pages/posts/index.astro`)
- `web/src/components/sections/PhotosSection.astro` — photos (from `pages/photos/index.astro`)
- `web/src/components/sections/VideosSection.astro` — videos (from `pages/videos/index.astro`)
- `web/src/components/sections/PressSection.astro` — press (from `pages/press/index.astro`)
- `web/src/components/sections/MerchSection.astro` — merch list (from `pages/merch/index.astro`)
- `web/src/components/sections/EpkSection.astro` — EPK (from `pages/epk/index.astro`)
- `web/src/components/sections/ContactSection.astro` — contact (from `pages/contact/index.astro`)
- `web/src/components/sections/NewsletterSection.astro` — newsletter signup (from `pages/newsletter/index.astro`)
- `web/src/components/detail/ConcertDetail.astro` — concert detail (from `pages/concerts/[slug].astro`)
- `web/src/components/detail/PostDetail.astro` — post detail (from `pages/posts/[id].astro`)
- `web/src/components/detail/ReleaseDetail.astro` — release detail (from `pages/releases/[id].astro`)
- `web/src/components/detail/MerchItemDetail.astro` — merch item (from `pages/merch/[slug].astro`)
- `web/src/pages/[lang]/index.astro` — home page
- `web/src/pages/[lang]/[section].astro` — section list router
- `web/src/pages/[lang]/[section]/[slug].astro` — item detail router

**Modified:**
- `web/src/lib/cms.ts` — update `SiteConfig` type + add `lang` param to `getSiteConfig`
- `web/astro.config.mjs` — `prefixDefaultLocale: true`
- `web/src/pages/index.astro` — redirect to `/en`
- `web/src/layouts/BaseLayout.astro` — add optional `lang` + `alternateHref` props
- `web/src/components/Footer.astro` — dynamic nav links + `LanguageSelector`
- `web/src/components/Header.astro` — locale-aware links from slug map
- `web/src/components/ShowsArchiveFilter.vue` — `slug` prop → `href` prop
- `web/src/components/ShowsMap.vue` — `slug` prop → `href` prop

**Deleted** (after section components are created):
- `web/src/pages/concerts/index.astro`, `web/src/pages/concerts/[slug].astro`
- `web/src/pages/releases/index.astro`, `web/src/pages/releases/[id].astro`
- `web/src/pages/posts/index.astro`, `web/src/pages/posts/[id].astro`
- `web/src/pages/merch/index.astro`, `web/src/pages/merch/[slug].astro`
- `web/src/pages/photos/index.astro`
- `web/src/pages/videos/index.astro`
- `web/src/pages/press/index.astro`
- `web/src/pages/epk/index.astro`
- `web/src/pages/contact/index.astro`
- `web/src/pages/newsletter/index.astro`

---

## Task 1: Create feature branch

**Files:** (git only)

- [ ] **Step 1: Create branch from latest main**

```bash
git checkout main && git pull
git checkout -b feature/language-selector-i18n
```

- [ ] **Step 2: Verify branch**

```bash
git branch --show-current
```
Expected output: `feature/language-selector-i18n`

---

## Task 2: Update `getSiteConfig` for multilingual labels

The existing `/api/site-config` endpoint already supports `?lang=en` / `?lang=pl` via Laravel's `SetLocale` middleware. We need to (a) add a `lang` parameter to `getSiteConfig`, and (b) expose `module_config` in the TypeScript `SiteConfig` interface (it is returned by the backend but currently untyped).

**Files:**
- Modify: `web/src/lib/cms.ts`

**Interfaces:**
- Produces: `getSiteConfig(lang?: Locale): Promise<SiteConfig>` where `SiteConfig.module_config` is `Record<string, { enabled: boolean; label: string; per_page: number | null }>`

- [ ] **Step 1: Update `SiteConfig` interface and `getSiteConfig` in `web/src/lib/cms.ts`**

Find the existing `SiteConfig` interface and `getSiteConfig` function (lines 121–137) and replace them with:

```ts
export interface ModuleConfig {
  enabled: boolean
  label: string
  per_page: number | null
}

export interface SiteConfig {
  modules: Record<string, boolean>
  module_order: string[]
  module_config: Record<string, ModuleConfig>
}

export async function getSiteConfig(lang: Locale = 'en'): Promise<SiteConfig> {
  try {
    const res = await fetch(`${BASE}/api/site-config?lang=${lang}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return { modules: {}, module_order: [], module_config: {} }
    return res.json() as Promise<SiteConfig>
  } catch {
    return { modules: {}, module_order: [], module_config: {} }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/cms.ts
git commit -m "feat(web): add lang param + module_config type to getSiteConfig"
```

---

## Task 3: Create `src/lib/slugs.ts` — build-time slug map

**Files:**
- Create: `web/src/lib/slugs.ts`

**Interfaces:**
- Produces:
  - `type SlugMap = { en: Record<string, string>; pl: Record<string, string> }`
  - `export const LOCALES: Locale[]`
  - `export function slugify(str: string): string`
  - `export async function getSlugMap(): Promise<SlugMap>`

The slug map is cached in module scope (re-used across all `getStaticPaths` calls in the same build process).

- [ ] **Step 1: Create `web/src/lib/slugs.ts`**

```ts
import type { Locale } from '@/types/shared'
import { getSiteConfig } from './cms'

export type SlugMap = { en: Record<string, string>; pl: Record<string, string> }

export const LOCALES: Locale[] = ['en', 'pl']

// Sections not managed by the CMS module system — slugs are hardcoded per locale.
const STATIC_SLUGS: SlugMap = {
  en: { contact: 'contact', newsletter: 'newsletter' },
  pl: { contact: 'kontakt', newsletter: 'newsletter' },
}

/**
 * Converts a display name to a URL-safe slug.
 * Handles Polish diacritics (ą→a, ę→e, ó→o, ł→l, etc.).
 */
export function slugify(str: string): string {
  return str
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip combining diacritics (ą→a, ę→e, ó→o, ź→z, etc.)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

let _cache: SlugMap | null = null

/**
 * Returns the full slug map for all modules + hardcoded sections.
 * Fetches /api/site-config for both locales in parallel; result is cached.
 */
export async function getSlugMap(): Promise<SlugMap> {
  if (_cache) return _cache

  const [enCfg, plCfg] = await Promise.all([
    getSiteConfig('en'),
    getSiteConfig('pl'),
  ])

  const map: SlugMap = {
    en: { ...STATIC_SLUGS.en },
    pl: { ...STATIC_SLUGS.pl },
  }

  for (const moduleSlug of Object.keys(enCfg.module_config)) {
    const enLabel = enCfg.module_config[moduleSlug]?.label ?? moduleSlug
    const plLabel = plCfg.module_config[moduleSlug]?.label ?? enLabel
    map.en[moduleSlug] = slugify(enLabel) || moduleSlug
    map.pl[moduleSlug] = slugify(plLabel) || moduleSlug
  }

  _cache = map
  return _cache
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/slugs.ts
git commit -m "feat(web): add build-time slug map helper (slugs.ts)"
```

---

## Task 4: Create `LanguageSelector.astro`

Zero-JS component. Receives the current `lang` and the pre-computed `alternateHref` (the equivalent page in the other locale). Renders two `<a>` tags with flags.

**Files:**
- Create: `web/src/components/LanguageSelector.astro`

**Interfaces:**
- Consumes: `lang: Locale`, `alternateHref: string` (from BaseLayout → Footer)
- Produces: static HTML with two `<a>` tags; no JS emitted

- [ ] **Step 1: Create `web/src/components/LanguageSelector.astro`**

```astro
---
import type { Locale } from '@/types/shared'

interface Props {
  lang: Locale
  alternateHref: string
}

const { lang, alternateHref } = Astro.props
const currentHref = Astro.url.pathname
---

<div class="lang-selector" aria-label="Language selector">
  <a
    href={lang === 'en' ? currentHref : alternateHref}
    class:list={['lang-option', { 'is-active': lang === 'en' }]}
    aria-current={lang === 'en' ? 'true' : undefined}
    hreflang="en"
  >
    🇬🇧 English
  </a>
  <span class="lang-sep" aria-hidden="true">·</span>
  <a
    href={lang === 'pl' ? currentHref : alternateHref}
    class:list={['lang-option', { 'is-active': lang === 'pl' }]}
    aria-current={lang === 'pl' ? 'true' : undefined}
    hreflang="pl"
  >
    🇵🇱 Polski
  </a>
</div>

<style>
  .lang-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 700 11px/1 'Archivo', sans-serif;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .lang-option {
    color: inherit;
    text-decoration: none;
    opacity: 0.5;
    transition: opacity .15s;
  }
  .lang-option:hover { opacity: 1; }
  .lang-option.is-active {
    opacity: 1;
    cursor: default;
    pointer-events: none;
  }
  .lang-sep { opacity: 0.3; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/LanguageSelector.astro
git commit -m "feat(web): add LanguageSelector.astro component (zero JS)"
```

---

## Task 5: Update `BaseLayout.astro`

Add optional `lang` and `alternateHref` props. Pass `lang` to the `<html lang>` attribute and both down to `<Footer>`.

**Files:**
- Modify: `web/src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes (new): `lang?: Locale` (default `'en'`), `alternateHref?: string`
- Produces: passes both to `<Footer lang alternateHref>`; sets `<html lang={lang}>`

- [ ] **Step 1: Update `web/src/layouts/BaseLayout.astro`**

Replace the entire file content with:

```astro
---
import type { Locale } from '@/types/shared'
import BaseHead from '@/components/BaseHead.astro'
import Header from '@/components/Header.astro'
import Footer from '@/components/Footer.astro'
import CartDrawer from '@/components/CartDrawer.vue'
import '@/styles/global.css'

export interface Props {
  title: string
  description: string
  image?: string | null
  canonical?: string
  noindex?: boolean
  structuredData?: object
  bandName?: string
  lang?: Locale
  alternateHref?: string
}

const {
  title,
  description,
  image,
  canonical,
  noindex,
  structuredData,
  bandName = 'Skanking Storks',
  lang = 'en',
  alternateHref,
} = Astro.props

const pageTitle = title === bandName ? title : `${title} — ${bandName}`
---

<!doctype html>
<html lang={lang}>
  <head>
    <BaseHead
      title={pageTitle}
      description={description}
      image={image}
      canonical={canonical}
      noindex={noindex}
      structuredData={structuredData}
    />
    <slot name="head" />
  </head>
  <body class="flex min-h-screen flex-col">
    <Header lang={lang} />
    <main class="flex-1">
      <slot />
    </main>
    <Footer lang={lang} alternateHref={alternateHref} />
    <CartDrawer client:idle />
  </body>
</html>
```

- [ ] **Step 2: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```

Expected: errors for `Header` and `Footer` not accepting `lang` yet — that's expected; they'll be fixed in Tasks 6 and 7.

- [ ] **Step 3: Commit**

```bash
git add web/src/layouts/BaseLayout.astro
git commit -m "feat(web): add lang + alternateHref props to BaseLayout"
```

---

## Task 6: Update `Footer.astro` — dynamic nav + LanguageSelector

Replace hardcoded links with CMS-driven links built from the slug map. Add `LanguageSelector` at the bottom.

**Files:**
- Modify: `web/src/components/Footer.astro`

**Interfaces:**
- Consumes: `lang?: Locale` (default `'en'`), `alternateHref?: string`
- Consumes from CMS: `getSiteConfig(lang)` for enabled modules + ordering; `getSlugMap()` for href paths

- [ ] **Step 1: Replace `web/src/components/Footer.astro`**

```astro
---
import type { Locale } from '@/types/shared'
import LanguageSelector from '@/components/LanguageSelector.astro'
import { getSiteConfig } from '@/lib/cms'
import { getSlugMap } from '@/lib/slugs'

interface Props {
  lang?: Locale
  alternateHref?: string
}

const { lang = 'en', alternateHref } = Astro.props

const [siteConfig, slugMap] = await Promise.all([
  getSiteConfig(lang),
  getSlugMap(),
])

const year = new Date().getFullYear()

// CMS-module nav links, ordered by module_order, filtered to enabled only.
// contact + newsletter are always shown (not in module system).
const MODULE_LINK_SLUGS = ['concerts', 'releases', 'posts', 'photos', 'videos', 'press', 'merch', 'epk'] as const

const orderedSlugs = siteConfig.module_order.length > 0
  ? siteConfig.module_order
  : MODULE_LINK_SLUGS.slice()

const moduleLinks = orderedSlugs
  .filter(s => MODULE_LINK_SLUGS.includes(s as typeof MODULE_LINK_SLUGS[number]) && siteConfig.modules[s] !== false)
  .map(s => ({
    href: `/${lang}/${slugMap[lang][s] ?? s}`,
    label: siteConfig.module_config[s]?.label ?? s,
  }))

const staticLinks = [
  { href: `/${lang}/${slugMap[lang].contact}`, label: lang === 'pl' ? 'Kontakt' : 'Contact' },
  { href: `/${lang}/${slugMap[lang].newsletter}`, label: 'Newsletter' },
]

const links = [...moduleLinks, ...staticLinks]
---

<footer class="border-t border-border mt-24 py-12 text-zinc-500 text-sm">
  <div class="mx-auto max-w-7xl px-4 sm:px-6">
    <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <!-- Brand -->
      <div>
        <a href={`/${lang}`} class="text-lg font-black text-white tracking-tight">Skanking Storks</a>
        <p class="mt-1 text-xs">Ska · Reggae · Good Vibes</p>
      </div>

      <!-- Nav -->
      <nav class="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer navigation">
        {links.map(({ href, label }) => (
          <a href={href} class="hover:text-white transition-colors">{label}</a>
        ))}
      </nav>
    </div>

    <div class="mt-8 border-t border-border pt-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
      <p>&copy; {year} Skanking Storks. All rights reserved.</p>
      <div class="flex items-center gap-6">
        {alternateHref && (
          <LanguageSelector lang={lang} alternateHref={alternateHref} />
        )}
        <a href="/admin" class="hover:text-white transition-colors">Admin</a>
      </div>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Footer.astro
git commit -m "feat(web): dynamic nav + LanguageSelector in Footer"
```

---

## Task 7: Update `Header.astro` — locale-aware links

Replace the hardcoded `MODULE_LINK_MAP` hrefs with locale-prefixed hrefs from the slug map. Use `module_config[slug].label` as the link label (so custom names show in the nav).

**Files:**
- Modify: `web/src/components/Header.astro`

**Interfaces:**
- Consumes: `lang?: Locale` (default `'en'`); added to the component props

- [ ] **Step 1: Update the frontmatter of `web/src/components/Header.astro`**

Replace the entire `---` frontmatter block (lines 1–33) with:

```ts
---
import type { Locale } from '@/types/shared'
import { getSiteConfig } from '@/lib/cms'
import { getSlugMap } from '@/lib/slugs'
import MobileNav from './MobileNav.vue'
import CartIcon from './CartIcon.vue'

interface Props {
  lang?: Locale
}
const { lang = 'en' } = Astro.props

const [siteConfig, slugMap] = await Promise.all([
  getSiteConfig(lang),
  getSlugMap(),
])

const MODULE_SLUGS = ['concerts', 'releases', 'posts', 'photos', 'videos', 'press', 'merch', 'epk'] as const

const orderedSlugs = siteConfig.module_order.length > 0
  ? siteConfig.module_order
  : MODULE_SLUGS.slice()

const moduleLinks = orderedSlugs
  .filter(s => MODULE_SLUGS.includes(s as typeof MODULE_SLUGS[number]) && siteConfig.modules[s] !== false)
  .map(s => ({
    href: `/${lang}/${slugMap[lang][s] ?? s}`,
    label: siteConfig.module_config[s]?.label ?? s,
    module: s,
  }))

const links = [
  ...moduleLinks,
  { href: `/${lang}/${slugMap[lang].contact}`, label: lang === 'pl' ? 'Kontakt' : 'Contact', module: null },
]

const current = Astro.url.pathname
---
```

Keep the template (`<header>…</header>`) and `<style>` block unchanged. Also update the logo `<a>` href in the template from `href="/"` to `href={`/${lang}`}`.

- [ ] **Step 2: Update logo href in the template**

Find the line:
```astro
<a href="/" class="ss-logo">Skanking Storks</a>
```
Replace with:
```astro
<a href={`/${lang}`} class="ss-logo">Skanking Storks</a>
```

- [ ] **Step 3: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Header.astro
git commit -m "feat(web): locale-aware nav links in Header using slug map"
```

---

## Task 8: Update Vue islands — `slug` → `href`

`ShowsArchiveFilter.vue` and `ShowsMap.vue` both build hrefs as `` `/concerts/${c.slug}` ``. After the routing change, these would produce broken links. Change the prop from `slug: string` to `href: string` and update internal link construction.

**Files:**
- Modify: `web/src/components/ShowsArchiveFilter.vue`
- Modify: `web/src/components/ShowsMap.vue`

- [ ] **Step 1: Update `ShowsArchiveFilter.vue`**

Find the prop definition (line 6): `slug: string`
Change to: `href: string`

Find all internal uses of the slug to build hrefs:
- Line 68: `` <a :href="`/concerts/${c.slug}`" ``  → `` <a :href="c.href" ``
- Line 72: `` <a :href="`/concerts/${c.slug}`" `` → `` <a :href="c.href" ``

- [ ] **Step 2: Update `ShowsMap.vue`**

Find the prop definition (line 6): `slug: string`
Change to: `href: string`

Find line 58 inside the Leaflet popup string:
```
href="/concerts/${c.slug}"
```
Change to:
```
href="${c.href}"
```

Note: This is inside a template literal string passed to Leaflet's popup. The surrounding string uses `${}` interpolation — update accordingly so `c.href` (not `c.slug`) is interpolated.

- [ ] **Step 3: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ShowsArchiveFilter.vue web/src/components/ShowsMap.vue
git commit -m "fix(web): ShowsArchiveFilter + ShowsMap accept full href instead of slug"
```

---

## Task 9: Update Astro config + root redirect

**Files:**
- Modify: `web/astro.config.mjs`
- Modify: `web/src/pages/index.astro`

- [ ] **Step 1: Update `web/astro.config.mjs`**

Change `prefixDefaultLocale: false` to `prefixDefaultLocale: true`:

```js
i18n: {
  defaultLocale: 'en',
  locales: ['en', 'pl'],
  routing: { prefixDefaultLocale: true },
},
```

- [ ] **Step 2: Replace `web/src/pages/index.astro` with a redirect**

```astro
---
return Astro.redirect('/en', 301)
---
```

- [ ] **Step 3: Commit**

```bash
git add web/astro.config.mjs web/src/pages/index.astro
git commit -m "feat(web): enable prefixDefaultLocale, redirect root to /en"
```

---

## Task 10: Create `[lang]/index.astro` (home page)

Move the home page into the locale-aware routing. Content comes from the existing `src/pages/index.astro` (before it was replaced by the redirect in Task 9 — the original content is in git history, or use the file you'll have deleted; work from the version in git before Task 9's commit).

**Files:**
- Create: `web/src/pages/[lang]/index.astro`

**Interfaces:**
- Consumes: `getSlugMap()`, `getBandProfile(lang)`, `getConcerts()`, `getReleases(lang)`, `getPosts(lang, 1)`, `getSocialLinks()`
- Produces: static HTML at `/en` and `/pl`; passes `lang` + `alternateHref` to `BaseLayout`

- [ ] **Step 1: Create `web/src/pages/[lang]/index.astro`**

Start from the content of the old `src/pages/index.astro` (git show HEAD~1:web/src/pages/index.astro). The key structural changes from the original are:

**Frontmatter additions** (add at the top of the `---` block, before existing imports):

```ts
import type { Locale } from '@/types/shared'
import { getSlugMap, LOCALES } from '@/lib/slugs'

export async function getStaticPaths() {
  return LOCALES.map(lang => ({ params: { lang } }))
}

const { lang } = Astro.params as { lang: Locale }
const slugMap = await getSlugMap()
const otherLang: Locale = lang === 'en' ? 'pl' : 'en'
const alternateHref = `/${otherLang}`
```

**CMS call changes** — replace the existing parallel fetch with:
```ts
const [profile, concerts, releases, { data: posts }, socialLinks] = await Promise.all([
  getBandProfile(lang),         // was getBandProfile('en')
  getConcerts(),
  getReleases(lang),             // was getReleases('en')
  getPosts(lang, 1),             // was getPosts('en', 1)
  getSocialLinks(),
])
```

**BaseLayout call** — add `lang` and `alternateHref`:
```astro
<BaseLayout
  lang={lang}
  alternateHref={alternateHref}
  title={profile.name}
  description={...}
  structuredData={structuredData}
>
```

**Internal link updates** — find every hardcoded path in the template and prefix with `/${lang}/`:
- `href="/concerts"` → `href={`/${lang}/${slugMap[lang].concerts}`}`
- `href={`/concerts/${c.slug_en}`}` → `href={`/${lang}/${slugMap[lang].concerts}/${c.slug_en}`}`
- `href="/releases"` → `href={`/${lang}/${slugMap[lang].releases}`}`
- `href={`/releases/${r.id}`}` → `href={`/${lang}/${slugMap[lang].releases}/${r.id}`}`
- `href="/posts"` → `href={`/${lang}/${slugMap[lang].posts}`}`
- `href={`/posts/${p.id}`}` → `href={`/${lang}/${slugMap[lang].posts}/${p.id}`}`
- `href="/contact"` → `href={`/${lang}/${slugMap[lang].contact}`}`
- `href="/newsletter"` → `href={`/${lang}/${slugMap[lang].newsletter}`}`

All other template content (CSS, markup structure, sections) is copied verbatim from the original.

- [ ] **Step 2: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/[lang]/index.astro
git commit -m "feat(web): locale-aware home page at [lang]/index.astro"
```

---

## Task 11: Create section list components

Each section component accepts `lang: Locale` and `alternateHref: string`, fetches its own data using `lang`, renders the full page via `BaseLayout`, and uses locale-prefixed hrefs for internal links.

**Pattern** (demonstrated with `ConcertsSection.astro`; all others follow the same structure):

**Files:**
- Create: `web/src/components/sections/ConcertsSection.astro`

**Interfaces (all section components share this interface):**
- Props: `lang: Locale`, `alternateHref: string`
- Renders: full page HTML wrapped in `<BaseLayout lang alternateHref ...>`

- [ ] **Step 1: Create `web/src/components/sections/ConcertsSection.astro`**

Copy the entire content of `web/src/pages/concerts/index.astro`. Then apply these changes:

**Add to top of `---` block:**
```ts
import type { Locale } from '@/types/shared'
import { getSlugMap } from '@/lib/slugs'

interface Props {
  lang: Locale
  alternateHref: string
}
const { lang, alternateHref } = Astro.props
const slugMap = await getSlugMap()
```

**Remove** the module guard at the top (it is handled by the section router in Task 13):
```ts
// Remove these lines:
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['concerts'] === false) return Astro.redirect('/404', 307)
```

**CMS call changes:**
```ts
const [concerts, profile] = await Promise.all([
  getConcerts(),
  getBandProfile(lang),   // was getBandProfile('en')
])
```

**BaseLayout call** — add lang + alternateHref:
```astro
<BaseLayout
  lang={lang}
  alternateHref={alternateHref}
  title={`Shows — ${profile.name}`}
  description={...}
>
```

**Internal link updates in the template:**
- `href={`/concerts/${c.slug_en}`}` → `href={`/${lang}/${slugMap[lang].concerts}/${c.slug_en}`}`
- `href="/newsletter"` → `href={`/${lang}/${slugMap[lang].newsletter}`}`

**ShowsMap slug prop → href prop:**
```astro
concerts={concertsWithCoords.map(c => ({
  id: c.id,
  href: `/${lang}/${slugMap[lang].concerts}/${c.slug_en}`,  // was: slug: c.slug_en
  lat: c.venue.latitude as number,
  ...
}))}
```

**ShowsArchiveFilter slug prop → href prop:**
```astro
concerts={past.map(c => ({
  id: c.id,
  href: `/${lang}/${slugMap[lang].concerts}/${c.slug_en}`,  // was: slug: c.slug_en
  ...
}))}
```

All CSS and remaining markup is copied verbatim.

- [ ] **Step 2: Create the remaining section components**

For each file below, copy the source page, add the same `Props` interface + `lang`/`alternateHref` destructuring + `slugMap` fetch, update CMS calls and internal links as described:

| Component | Source file | CMS calls that take `lang` | Internal links to update |
|---|---|---|---|
| `ReleasesSection.astro` | `pages/releases/index.astro` | `getReleases(lang)`, `getBandProfile(lang)` | `/releases` → `/${lang}/${slugMap[lang].releases}`, `/releases/${r.id}` → `/${lang}/${slugMap[lang].releases}/${r.id}` |
| `PostsSection.astro` | `pages/posts/index.astro` | `getPosts(lang, page)`, `getBandProfile(lang)` | `/posts` stays, `/posts/${p.id}` → `/${lang}/${slugMap[lang].posts}/${p.id}` |
| `PhotosSection.astro` | `pages/photos/index.astro` | `getBandProfile(lang)` (if used) | None likely |
| `VideosSection.astro` | `pages/videos/index.astro` | none | None |
| `PressSection.astro` | `pages/press/index.astro` | none | None |
| `MerchSection.astro` | `pages/merch/index.astro` | `getBandProfile(lang)` (if used) | `/merch/${item.slug}` → `/${lang}/${slugMap[lang].merch}/${item.slug}` |
| `EpkSection.astro` | `pages/epk/index.astro` | `getEpk(lang)`, `getBandProfile(lang)` | `/rider` can stay as-is (root route) |
| `ContactSection.astro` | `pages/contact/index.astro` | `getBandProfile(lang)` (if used) | None likely |
| `NewsletterSection.astro` | `pages/newsletter/index.astro` | none | None |

Each component: copy source → add Props interface → update CMS calls → update internal hrefs.

- [ ] **Step 3: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/sections/
git commit -m "feat(web): extract section list components with locale props"
```

---

## Task 12: Create `[lang]/[section].astro` — section list router

A thin routing page that enumerates all sections × locales in `getStaticPaths`, then dispatches to the appropriate section component.

**Files:**
- Create: `web/src/pages/[lang]/[section].astro`

**Interfaces:**
- Consumes: `getSlugMap()`, `getSiteConfig(lang)` in `getStaticPaths`
- Produces params: `{ lang: Locale, section: string }` where `section` is the CMS-derived slug
- Produces props: `{ sectionType: string, lang: Locale, alternateHref: string }`

- [ ] **Step 1: Create `web/src/pages/[lang]/[section].astro`**

```astro
---
import type { Locale } from '@/types/shared'
import { getSlugMap, LOCALES } from '@/lib/slugs'

import ConcertsSection   from '@/components/sections/ConcertsSection.astro'
import ReleasesSection   from '@/components/sections/ReleasesSection.astro'
import PostsSection      from '@/components/sections/PostsSection.astro'
import PhotosSection     from '@/components/sections/PhotosSection.astro'
import VideosSection     from '@/components/sections/VideosSection.astro'
import PressSection      from '@/components/sections/PressSection.astro'
import MerchSection      from '@/components/sections/MerchSection.astro'
import EpkSection        from '@/components/sections/EpkSection.astro'
import ContactSection    from '@/components/sections/ContactSection.astro'
import NewsletterSection from '@/components/sections/NewsletterSection.astro'

// Section types that have list pages but NOT detail pages.
// Detail pages (concerts/[slug], posts/[id], releases/[id], merch/[slug])
// are handled by [section]/[slug].astro.
const LIST_ONLY_SECTIONS = ['photos', 'videos', 'press', 'epk', 'contact', 'newsletter'] as const
const DETAIL_SECTIONS    = ['concerts', 'releases', 'posts', 'merch'] as const
const ALL_SECTIONS       = [...LIST_ONLY_SECTIONS, ...DETAIL_SECTIONS] as const

export async function getStaticPaths() {
  const slugMap = await getSlugMap()

  return LOCALES.flatMap(lang =>
    ALL_SECTIONS.map(sectionType => {
      const otherLang: Locale = lang === 'en' ? 'pl' : 'en'
      return {
        params: {
          lang,
          section: slugMap[lang][sectionType] ?? sectionType,
        },
        props: {
          sectionType,
          lang,
          alternateHref: `/${otherLang}/${slugMap[otherLang][sectionType] ?? sectionType}`,
        },
      }
    })
  )
}

interface Props {
  sectionType: string
  lang: Locale
  alternateHref: string
}

const { sectionType, lang, alternateHref } = Astro.props
---

{sectionType === 'concerts'   && <ConcertsSection   lang={lang} alternateHref={alternateHref} />}
{sectionType === 'releases'   && <ReleasesSection   lang={lang} alternateHref={alternateHref} />}
{sectionType === 'posts'      && <PostsSection      lang={lang} alternateHref={alternateHref} />}
{sectionType === 'photos'     && <PhotosSection     lang={lang} alternateHref={alternateHref} />}
{sectionType === 'videos'     && <VideosSection     lang={lang} alternateHref={alternateHref} />}
{sectionType === 'press'      && <PressSection      lang={lang} alternateHref={alternateHref} />}
{sectionType === 'merch'      && <MerchSection      lang={lang} alternateHref={alternateHref} />}
{sectionType === 'epk'        && <EpkSection        lang={lang} alternateHref={alternateHref} />}
{sectionType === 'contact'    && <ContactSection    lang={lang} alternateHref={alternateHref} />}
{sectionType === 'newsletter' && <NewsletterSection lang={lang} alternateHref={alternateHref} />}
```

- [ ] **Step 2: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/[lang]/[section].astro
git commit -m "feat(web): add [lang]/[section].astro section list router"
```

---

## Task 13: Create detail components + `[lang]/[section]/[slug].astro`

Four section types have item detail pages: `concerts`, `releases`, `posts`, `merch`. Extract each into a detail component, then wire them into the `[slug]` catch-all router.

**Files:**
- Create: `web/src/components/detail/ConcertDetail.astro`
- Create: `web/src/components/detail/PostDetail.astro`
- Create: `web/src/components/detail/ReleaseDetail.astro`
- Create: `web/src/components/detail/MerchItemDetail.astro`
- Create: `web/src/pages/[lang]/[section]/[slug].astro`

**Interfaces (all detail components):**
- Props: `lang: Locale`, `alternateHref: string`, `itemId: number` (or `itemSlug: string` for concerts and merch)
- Renders: full page HTML in `<BaseLayout lang alternateHref ...>`

- [ ] **Step 1: Create `ConcertDetail.astro`**

Copy content of `web/src/pages/concerts/[slug].astro`. Apply:

```ts
import type { Locale } from '@/types/shared'
import { getSlugMap } from '@/lib/slugs'

interface Props {
  lang: Locale
  alternateHref: string
  itemId: number
}
const { lang, alternateHref, itemId } = Astro.props
const slugMap = await getSlugMap()
```

Remove `getStaticPaths` (it moves to the router). Change `const { slug } = Astro.params` + the CMS lookup to use `itemId` directly:
```ts
// was: const { slug } = Astro.params; const concert = await getConcertBySlug(slug) or similar
const concert = await getConcert(itemId)
```

Update `getBandProfile('en')` → `getBandProfile(lang)` if present.

Update `BaseLayout` call to include `lang={lang}` and `alternateHref={alternateHref}`.

Update any internal hrefs (e.g. newsletter link) to locale-prefixed form.

- [ ] **Step 2: Create `PostDetail.astro`**

Copy content of `web/src/pages/posts/[id].astro`. Apply:

```ts
interface Props {
  lang: Locale
  alternateHref: string
  itemId: number
}
const { lang, alternateHref, itemId } = Astro.props
const slugMap = await getSlugMap()
```

Remove `getStaticPaths`. Change CMS lookup:
```ts
const post = await getPost(itemId, lang)   // was getPost(Number(Astro.params.id), 'en')
```

Update BaseLayout + any internal links.

- [ ] **Step 3: Create `ReleaseDetail.astro`**

Copy content of `web/src/pages/releases/[id].astro`. Apply:

```ts
interface Props {
  lang: Locale
  alternateHref: string
  itemId: number
}
const { lang, alternateHref, itemId } = Astro.props
const slugMap = await getSlugMap()
```

Remove `getStaticPaths`. Change CMS lookup:
```ts
const release = await getRelease(itemId, lang)
```

Update BaseLayout + internal links.

- [ ] **Step 4: Create `MerchItemDetail.astro`**

Copy content of `web/src/pages/merch/[slug].astro`. Apply:

```ts
interface Props {
  lang: Locale
  alternateHref: string
  itemSlug: string
}
const { lang, alternateHref, itemSlug } = Astro.props
const slugMap = await getSlugMap()
```

Remove `getStaticPaths`. Change CMS lookup:
```ts
const item = await getShopItem(itemSlug)
```

Update BaseLayout + internal links.

- [ ] **Step 5: Create `web/src/pages/[lang]/[section]/[slug].astro`**

```astro
---
import type { Locale } from '@/types/shared'
import { getSlugMap, LOCALES } from '@/lib/slugs'
import { getConcerts, getPosts, getReleases, getShopItems } from '@/lib/cms'

import ConcertDetail  from '@/components/detail/ConcertDetail.astro'
import PostDetail     from '@/components/detail/PostDetail.astro'
import ReleaseDetail  from '@/components/detail/ReleaseDetail.astro'
import MerchItemDetail from '@/components/detail/MerchItemDetail.astro'

const DETAIL_SECTIONS = ['concerts', 'releases', 'posts', 'merch'] as const

export async function getStaticPaths() {
  const slugMap = await getSlugMap()
  const [concerts, posts, releases, shopItems] = await Promise.all([
    getConcerts(),
    getPosts('en').then(r => r.data),
    getReleases('en'),
    getShopItems(),
  ])

  const paths = []

  for (const lang of LOCALES) {
    const otherLang: Locale = lang === 'en' ? 'pl' : 'en'

    // Concerts
    for (const c of concerts) {
      paths.push({
        params: { lang, section: slugMap[lang].concerts, slug: c.slug_en },
        props: { sectionType: 'concerts', lang, itemId: c.id, itemSlug: c.slug_en,
          alternateHref: `/${otherLang}/${slugMap[otherLang].concerts}/${c.slug_en}` },
      })
    }

    // Posts
    for (const p of posts) {
      paths.push({
        params: { lang, section: slugMap[lang].posts, slug: String(p.id) },
        props: { sectionType: 'posts', lang, itemId: p.id, itemSlug: '',
          alternateHref: `/${otherLang}/${slugMap[otherLang].posts}/${p.id}` },
      })
    }

    // Releases
    for (const r of releases) {
      paths.push({
        params: { lang, section: slugMap[lang].releases, slug: String(r.id) },
        props: { sectionType: 'releases', lang, itemId: r.id, itemSlug: '',
          alternateHref: `/${otherLang}/${slugMap[otherLang].releases}/${r.id}` },
      })
    }

    // Merch items
    for (const item of shopItems) {
      paths.push({
        params: { lang, section: slugMap[lang].merch, slug: item.slug },
        props: { sectionType: 'merch', lang, itemId: 0, itemSlug: item.slug,
          alternateHref: `/${otherLang}/${slugMap[otherLang].merch}/${item.slug}` },
      })
    }
  }

  return paths
}

interface Props {
  sectionType: string
  lang: Locale
  alternateHref: string
  itemId: number
  itemSlug: string
}

const { sectionType, lang, alternateHref, itemId, itemSlug } = Astro.props
---

{sectionType === 'concerts'  && <ConcertDetail   lang={lang} alternateHref={alternateHref} itemId={itemId} />}
{sectionType === 'posts'     && <PostDetail      lang={lang} alternateHref={alternateHref} itemId={itemId} />}
{sectionType === 'releases'  && <ReleaseDetail   lang={lang} alternateHref={alternateHref} itemId={itemId} />}
{sectionType === 'merch'     && <MerchItemDetail lang={lang} alternateHref={alternateHref} itemSlug={itemSlug} />}
```

> **Note:** `getPosts('en')` in `getStaticPaths` fetches page 1 only. If posts are paginated and page 2+ exist, use `getPosts` in a loop. For now, enumerate only page-1 posts; extend with pagination in a follow-up if needed.

- [ ] **Step 6: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add web/src/components/detail/ web/src/pages/[lang]/[section]/
git commit -m "feat(web): detail components + [lang]/[section]/[slug].astro router"
```

---

## Task 14: Delete old page files

Now that all section content lives in components and the new routers are in place, remove the old top-level page files.

**Files to delete:**
- `web/src/pages/concerts/index.astro`
- `web/src/pages/concerts/[slug].astro`
- `web/src/pages/releases/index.astro`
- `web/src/pages/releases/[id].astro`
- `web/src/pages/posts/index.astro`
- `web/src/pages/posts/[id].astro`
- `web/src/pages/merch/index.astro`
- `web/src/pages/merch/[slug].astro`
- `web/src/pages/photos/index.astro`
- `web/src/pages/videos/index.astro`
- `web/src/pages/press/index.astro`
- `web/src/pages/epk/index.astro`
- `web/src/pages/contact/index.astro`
- `web/src/pages/newsletter/index.astro`

- [ ] **Step 1: Delete old page files**

```bash
git rm web/src/pages/concerts/index.astro web/src/pages/concerts/[slug].astro
git rm web/src/pages/releases/index.astro "web/src/pages/releases/[id].astro"
git rm web/src/pages/posts/index.astro "web/src/pages/posts/[id].astro"
git rm web/src/pages/merch/index.astro "web/src/pages/merch/[slug].astro"
git rm web/src/pages/photos/index.astro web/src/pages/videos/index.astro
git rm web/src/pages/press/index.astro web/src/pages/epk/index.astro
git rm web/src/pages/contact/index.astro web/src/pages/newsletter/index.astro
```

- [ ] **Step 2: TypeScript check**

```bash
cd web && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(web): delete old page files superseded by [lang] routing"
```

---

## Task 15: Verify build + smoke test

- [ ] **Step 1: Run full Astro build**

```bash
cd web && pnpm build
```
Expected: build completes without errors. Check that output directory (`dist/`) contains `en/` and `pl/` subdirectories.

- [ ] **Step 2: Verify output structure**

```bash
ls web/dist/en/ && ls web/dist/pl/
```
Expected: both directories exist; `en/` contains `index.html` and section folders; `pl/` mirrors them with locale slugs.

- [ ] **Step 3: Check for hardcoded `'en'` in page frontmatter**

```bash
grep -rn "getBandProfile('en')\|getPosts('en')\|getReleases('en')\|getEpk('en')" web/src/components/sections/ web/src/components/detail/ web/src/pages/\[lang\]/
```
Expected: no matches. If any appear, fix them to use `lang`.

- [ ] **Step 4: Check for unhyphenated old route hrefs in components**

```bash
grep -rn "href=\"/concerts\|href=\"/posts\|href=\"/releases\|href=\"/merch\|href=\"/photos\|href=\"/videos\|href=\"/press\|href=\"/epk\|href=\"/contact\|href=\"/newsletter" web/src/components/ web/src/pages/\[lang\]/
```
Expected: no bare `/concerts`, `/posts` etc. — all should be `/${lang}/...`.

- [ ] **Step 5: Run backend tests**

```bash
make test
```
Expected: all Pest tests pass (backend is unchanged but confirm nothing regressed).

- [ ] **Step 6: Preview built site**

```bash
cd web && pnpm preview
```

Open `http://localhost:4321/en` and `http://localhost:4321/pl` in a browser. Verify:
- Home page loads in both locales
- Footer shows `🇬🇧 English · 🇵🇱 Polski` selector
- Clicking the inactive language navigates to the equivalent page
- Active language is visually muted (not a link)
- Section nav links in header and footer use locale-prefixed paths
- `view-source` shows full HTML (not an empty div)

- [ ] **Step 7: Commit and rebuild Docker web container**

```bash
git add -A
git commit -m "feat(web): full i18n wiring + language selector — verified build"
docker compose restart web
```
