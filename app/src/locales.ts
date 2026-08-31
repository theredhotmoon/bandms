/**
 * The admin SPA's locale registry — mirror of api/config/locales.php and
 * web/src/lib/locales.ts.
 *
 * Adding a language is one entry in each of the three, and nothing else: the
 * editors generate their per-locale tab strips and empty draft bags from
 * LOCALES rather than writing `['en', 'pl']` inline.
 *
 * The admin never resolves a translation down a fallback chain — it edits raw
 * bags, so a locale with no value must render an empty input, not the other
 * language's text. That is why there is no `fallbacks` here: the chain is a
 * display concern and belongs to the API and the public site.
 */

type LocaleMeta = {
  readonly name: string
  readonly nativeName: string
  readonly shortLabel: string
}

const REGISTRY = {
  en: { name: 'English', nativeName: 'English', shortLabel: 'EN' },
  pl: { name: 'Polish', nativeName: 'Polski', shortLabel: 'PL' },
} as const satisfies Record<string, LocaleMeta>

export type Lang = keyof typeof REGISTRY

export const LOCALES: Lang[] = Object.keys(REGISTRY) as Lang[]

export const DEFAULT_LOCALE: Lang = 'en'

/** A per-locale draft bag as the admin edits it — every key present. */
export type TranslationBag = Record<Lang, string>

export function isLocale(value: unknown): value is Lang {
  return typeof value === 'string' && (LOCALES as string[]).includes(value)
}

export function nativeName(locale: Lang): string {
  return REGISTRY[locale]?.nativeName ?? locale
}

/** Tab-strip label. */
export function shortLabel(locale: Lang): string {
  return REGISTRY[locale]?.shortLabel ?? locale.toUpperCase()
}

/**
 * A blank draft with one key per locale.
 *
 * Returns a new object each call — a shared frozen constant would be mutated by
 * whichever form v-modelled it first, and the next form would open pre-filled
 * with someone else's text.
 */
export function emptyBag(): TranslationBag {
  return Object.fromEntries(LOCALES.map(l => [l, ''])) as TranslationBag
}
