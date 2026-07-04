# Language Selector — Full i18n Wiring Design

**Date:** 2026-07-03  
**Status:** Approved  
**Scope:** Astro public site (`web/`) only — backend and admin SPA unchanged.

---

## Goal

Add a language selector (flag + text) to the public site footer that switches between English and Polish, landing the user on the equivalent page in the selected language. Wire up full end-to-end i18n so all pages fetch CMS content in the active locale.

---

## Section 1: Routing Architecture

### URL structure

Change `prefixDefaultLocale` from `false` to `true` in `astro.config.mjs`. All pages gain a locale prefix:

- English: `/en/`, `/en/live-dates`, `/en/news/my-post`
- Polish: `/pl/`, `/pl/imprezy`, `/pl/aktualnosci/moj-post`
- Root `/` redirects to `/en`

### Page file structure

```
src/pages/
  index.astro                    → redirect to /en
  [lang]/
    index.astro                  → home page
    [section].astro              → section list pages (concerts, posts, merch, …)
    [section]/
      [slug].astro               → item detail pages (post, release, …)
```

All existing individual page files (`concerts.astro`, `news.astro`, etc.) are deleted. Their content moves into `[section].astro` behind a `sectionType` switch.

### `getStaticPaths` pattern

Every page enumerates `lang × sectionType` (and `× itemSlug` for detail pages) via a shared slug map fetched at build time. `SECTION_TYPES` is a constant array of all known section type keys (e.g. `['concerts', 'posts', 'merch', 'photos', 'videos', 'press', 'epk', 'contact', 'newsletter']`), matching the module slugs defined in the backend's `LIST_SLUGS`.

```ts
export async function getStaticPaths() {
  const slugMap = await getSlugMap()
  return SECTION_TYPES.flatMap(type => [
    { params: { lang: 'en', section: slugMap.en[type] }, props: { sectionType: type } },
    { params: { lang: 'pl', section: slugMap.pl[type] }, props: { sectionType: type } },
  ])
}
```

### Header nav links

`Header.astro` receives a `lang` prop and uses the slug map to build locale-prefixed nav links (`/en/live-dates`, `/pl/imprezy`). No hardcoded path segments.

---

## Section 2: Slug System (`src/lib/slugs.ts`)

Calls `GET /api/modules` (the same endpoint used by the admin SPA) at build time to fetch all module configurations. Slugifies the module's **EN name** for English URLs and **PL name** for Polish URLs — separately, so slugs can differ per language.

### Types

```ts
// forward: sectionType → URL slug (per lang)
type SlugMap = { en: Record<string, string>; pl: Record<string, string> }
```

### Example output

```ts
{
  en: { concerts: 'live-dates', posts: 'news', merch: 'shop' },
  pl: { concerts: 'imprezy', posts: 'aktualnosci', merch: 'sklep' },
}
```

### Slugification rule

Lowercase, replace spaces/special chars with hyphens, strip diacritics (Polish chars → ASCII equivalents). Standard URL slug behaviour.

### Language switcher alternate URL

Because EN and PL slugs differ, the language switcher cannot perform a simple prefix swap. Each page computes its own `alternateHref` at build time:

```ts
const otherLang = lang === 'en' ? 'pl' : 'en'
const alternateSection = slugMap[otherLang][sectionType]
const alternateHref = `/${otherLang}/${alternateSection}`
```

For item detail pages, the item slug is assumed to be language-agnostic (same identifier in both locales). If an item has no PL equivalent, `alternateHref` falls back to the section root in the other language.

---

## Section 3: Page Restructuring

### Deleted files

All current top-level section pages in `src/pages/` (e.g. `concerts.astro`, `news.astro`, `merch.astro`, contact, epk, photos, videos, press, shows-archive).

### New files

| File | Purpose |
|---|---|
| `src/pages/index.astro` | Redirect to `/en` |
| `src/pages/[lang]/index.astro` | Home page, fetches profile + posts for active lang |
| `src/pages/[lang]/[section].astro` | All section list pages; switches on `sectionType` prop |
| `src/pages/[lang]/[section]/[slug].astro` | Item detail pages (posts, releases) |

### `[section].astro` switch

```ts
const { lang, sectionType } = Astro.props
// fetch correct data based on sectionType
// render correct content component
switch (sectionType) {
  case 'concerts': ...
  case 'posts': ...
  case 'merch': ...
  // etc.
}
```

Each branch fetches data using `lang` and renders the appropriate presentational component.

---

## Section 4: Layout, Footer & Language Selector

### `BaseLayout.astro`

New props: `lang: Locale`, `alternateHref: string`. Both passed to `Footer`.

### `Header.astro`

New prop: `lang: Locale`. Uses slug map to build locale-prefixed nav links dynamically. Module custom names (for the active lang) become link labels.

### `Footer.astro`

New props: `lang: Locale`, `alternateHref: string`. Fetches slug map in frontmatter to build nav links dynamically — renamed or disabled modules automatically reflect. Renders `<LanguageSelector>` at the bottom.

### `LanguageSelector.astro` (new component)

**Zero JS** — pure Astro, no Vue island, no hydration directive.

Props:
```ts
interface Props {
  lang: Locale
  alternateHref: string
}
```

Renders two `<a>` tags. Active language styled via CSS (reduced opacity / heavier weight). Inactive language links to `alternateHref`.

```astro
<div class="lang-selector">
  <a href={lang === 'en' ? Astro.url.pathname : alternateHref}
     aria-current={lang === 'en' ? 'true' : undefined}>
    🇬🇧 English
  </a>
  <a href={lang === 'pl' ? Astro.url.pathname : alternateHref}
     aria-current={lang === 'pl' ? 'true' : undefined}>
    🇵🇱 Polski
  </a>
</div>
```

Placed in the footer for this milestone. Can be promoted to the header later without design changes.

---

## Out of Scope

- Backend changes (no new endpoints, no schema changes)
- Admin SPA changes
- Per-item language fallback logic beyond section-root fallback
- Language detection via `Accept-Language` header (SSG — no server at request time)
- Persisting language preference in localStorage (can be added later as a Vue island enhancement)

---

## Build & Test Checklist

- [ ] View-source on `/en/` and `/pl/` shows full HTML content (not empty SPA shell)
- [ ] All section slugs render correctly in both languages
- [ ] Language selector in footer shows correct active state
- [ ] Clicking alternate language link navigates to correct equivalent page
- [ ] Footer and header nav links use CMS-derived slugs
- [ ] `make test` passes (backend unaffected, but run to confirm)
- [ ] No hardcoded `'en'` strings remaining in page frontmatter CMS calls
