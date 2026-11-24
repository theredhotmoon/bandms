/**
 * The locale registry — the public site's mirror of api/config/locales.php.
 *
 * This file is the single declaration of which languages exist. `Locale` is
 * derived from it, so adding a language is one entry here plus the same entry
 * server-side; nothing else needs a `'pl'` in it.
 *
 * Why a mirror rather than reading /api/site-config: `Locale` is a compile-time
 * union that decides which routes `getStaticPaths` emits, and TypeScript cannot
 * widen a union from data fetched at build time.
 *
 * This file is the authority for everything the public site renders --
 * `LanguageSelector` reads `nativeName()`/`flag()` from here, not from the API,
 * so changing `native_name` in api/config/locales.php alone has no visible
 * effect. The API's `locales` block is consumed only by
 * `assertRegistryMatches`, which warns when the two drift.
 */

type LocaleMeta = {
  readonly name: string
  readonly nativeName: string
  readonly htmlLang: string
  readonly dateLocale: string
  /** Shown in the language switcher next to the native name. */
  readonly flag: string
  /**
   * Ordered fallbacks, and the whole fallback policy. Resolution walks
   * [locale, ...fallbacks] and stops at the first non-empty value. There is
   * deliberately no "then try every other locale" tail — invisible with two
   * locales, but at three it starts showing a German visitor Polish text.
   *
   * en <-> pl fall back to each other, which is a deliberate choice for THIS
   * pair (a half-translated FAQ should show the language it has rather than
   * render an empty accordion row) and is not a template for new locales. A
   * third locale should normally declare ['en'] alone.
   */
  readonly fallbacks: readonly string[]
}

const REGISTRY = {
  en: {
    name: 'English',
    nativeName: 'English',
    htmlLang: 'en',
    dateLocale: 'en-GB',
    flag: '\u{1F1EC}\u{1F1E7}',
    fallbacks: ['pl'],
  },
  pl: {
    name: 'Polish',
    nativeName: 'Polski',
    htmlLang: 'pl',
    dateLocale: 'pl-PL',
    flag: '\u{1F1F5}\u{1F1F1}',
    fallbacks: ['en'],
  },
} as const satisfies Record<string, LocaleMeta>

export type Locale = keyof typeof REGISTRY

export const LOCALES: Locale[] = Object.keys(REGISTRY) as Locale[]

export const DEFAULT_LOCALE: Locale = 'en'

export type TranslationBag = Partial<Record<Locale, string | null>>

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value)
}

/** Ordered resolution chain: the locale itself, then its declared fallbacks. */
export function localeChain(locale: Locale): Locale[] {
  const start = isLocale(locale) ? locale : DEFAULT_LOCALE
  return [...new Set([start, ...REGISTRY[start].fallbacks.filter(isLocale)])]
}

/**
 * Flatten a {"en": ..., "pl": ...} bag to one string.
 *
 * Returns null when nothing in the chain has a value, so a caller that feeds
 * markup decides for itself whether that means '' or a hidden section — the
 * choice stays visible at the call site rather than buried here.
 */
export function resolveTranslation(
  bag: TranslationBag | null | undefined,
  locale: Locale,
): string | null {
  if (!bag) return null

  for (const candidate of localeChain(locale)) {
    const value = bag[candidate]
    if (typeof value === 'string' && value.trim() !== '') return value
  }

  return null
}

/** BCP 47 tag for Intl / toLocaleDateString. */
export function dateLocale(locale: Locale): string {
  return REGISTRY[locale]?.dateLocale ?? REGISTRY[DEFAULT_LOCALE].dateLocale
}

/** The name a language calls itself — what a switcher should display. */
export function nativeName(locale: Locale): string {
  return REGISTRY[locale]?.nativeName ?? locale
}

/** Switcher flag. */
export function flag(locale: Locale): string {
  return REGISTRY[locale]?.flag ?? ''
}

/** Value of the <html lang> attribute. */
export function htmlLang(locale: Locale): string {
  return REGISTRY[locale]?.htmlLang ?? locale
}

/**
 * Report drift between this file and the API's registry.
 *
 * Warns rather than throws on purpose: the Astro build is all-or-nothing, and a
 * locale added server-side first must not take down all 35 pages. Returns the
 * codes the API knows about that this file does not.
 */
export function assertRegistryMatches(
  apiLocales: ReadonlyArray<{ code: string }> | undefined,
): string[] {
  if (!apiLocales?.length) return []

  const missing = apiLocales.map(l => l.code).filter(code => !isLocale(code))

  if (missing.length) {
    console.warn(
      `[locales] the API serves ${missing.join(', ')} but web/src/lib/locales.ts does not ` +
        `declare ${missing.length > 1 ? 'them' : 'it'}. Those languages will not be routed ` +
        `until they are added here.`,
    )
  }

  return missing
}

/**
 * Path per locale for the page currently being rendered.
 *
 * Produced by the route (only it knows the other locale's section slug) and
 * threaded to the layout, which hands it to the head and the switcher.
 */
export type Alternates = Partial<Record<Locale, string>>

interface PageUrlOptions { site: string; currentLocale: Locale; currentPath: string }

/** The page being rendered, from the `Astro` global. */
export function pageUrlOptions(astro: { site: URL | undefined; url: URL }, lang: Locale): PageUrlOptions {
  return { site: astro.site?.toString() ?? astro.url.origin, currentLocale: lang, currentPath: astro.url.pathname }
}

/**
 * Astro's default build.format is 'directory', so Astro.url.pathname always ends
 * in '/' and is percent-encoded. Every canonical and alternate is normalised to
 * that same form, which is also the one the sitemap lists. Only a real file
 * keeps its ending: record slugs are stored as typed, so "any dot" would take
 * the slash off a post called vol.2.
 */
function absoluteUrl(site: string, path: string): string {
  const p = path.startsWith('/') ? path : '/' + path
  const isFile = /\.(html|xml|txt)$/.test(p)
  return new URL(p.endsWith('/') || isFile ? p : p + '/', site).href
}

/** A locale's path for this page; the current locale falls back to the URL itself. */
function pathFor(alternates: Alternates, locale: Locale, opts: PageUrlOptions): string | undefined {
  return alternates[locale] ?? (locale === opts.currentLocale ? opts.currentPath : undefined)
}

/**
 * The one URL this page should be indexed at: the current locale's own entry in
 * the route's map, or the page itself when the route passes none.
 *
 * On a localised page the two are the same. On a legacy unlocalised one
 * (/posts/{id}, /about …) the entry is its /en/ twin — those pages named
 * *themselves* canonical until Nov 2026, so every English page was offered for
 * indexing twice. Read from the same map as hreflangLinks(), so the canonical
 * and the self-referential alternate cannot disagree.
 */
export function canonicalUrl(alternates: Alternates, opts: PageUrlOptions): string {
  return absoluteUrl(opts.site, pathFor(alternates, opts.currentLocale, opts) ?? opts.currentPath)
}

/**
 * Absolute <link rel="alternate"> rows for one page, plus x-default.
 *
 * This replaces a head that derived the alternates from Astro.url alone, under
 * a "/en is unprefixed" URL scheme the site had already stopped using: it
 * emitted hreflang="pl" href="/pl/en/" on the English page and claimed
 * hreflang="en" for /pl/. Nothing catches that — the markup is well-formed and
 * the build is green — so the rule is that every href comes from the route's
 * own map and is never derived by prefixing one locale's path with another.
 *
 * x-default points at the default locale rather than the current page, which is
 * the whole point of the annotation: it tells a crawler where to send a visitor
 * whose language matches nothing.
 */
export function hreflangLinks(
  alternates: Alternates,
  opts: PageUrlOptions,
): Array<{ hreflang: string; href: string }> {
  // A locale with no path is skipped rather than guessed at — a wrong alternate
  // is worse for a crawler than a missing one.
  const links = LOCALES.flatMap(l => {
    const path = pathFor(alternates, l, opts)
    return path ? [{ hreflang: htmlLang(l), href: absoluteUrl(opts.site, path) }] : []
  })

  const fallback = pathFor(alternates, DEFAULT_LOCALE, opts)
  if (fallback) links.push({ hreflang: 'x-default', href: absoluteUrl(opts.site, fallback) })

  return links
}
