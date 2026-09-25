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
  /**
   * BCP-47 tag for `Intl`, which is not the same thing as the locale code.
   * Bare `'en'` means US conventions — "May 8, 2026" — while this app has
   * always shown day-first. `web/src/lib/locales.ts` declares the same field
   * for the same reason; the two must agree, or one rider's version date
   * renders one way in the band's preview and another in the venue's copy.
   */
  readonly dateLocale: string
}

const REGISTRY = {
  en: { name: 'English', nativeName: 'English', shortLabel: 'EN', dateLocale: 'en-GB' },
  pl: { name: 'Polish', nativeName: 'Polski', shortLabel: 'PL', dateLocale: 'pl-PL' },
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
 * What `Intl` should be handed — never the bare locale code.
 *
 * Takes a plain string and narrows, because the commonest caller is
 * `useI18n().locale`, which vue-i18n types as `string`. Forcing each call site
 * to reach for the typed `uiLang` instead would be the kind of friction that
 * gets solved with a cast.
 */
export function dateLocale(locale: string): string {
  return isLocale(locale) ? REGISTRY[locale].dateLocale : REGISTRY[DEFAULT_LOCALE].dateLocale
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
