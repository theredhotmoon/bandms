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

/**
 * A full draft bag from a stored translation map.
 *
 * `legacy` is used ONLY when the map holds nothing in any locale — a record
 * from before the field was translatable, whose plain string the forms have
 * always shown as the default locale. It must not fill a single empty locale:
 * the API's resolved field (`val.bio_short`, `val.title`) is the text in
 * whichever `?lang=` the editor fetched, so filling an empty English slot from
 * it put the Polish bio into the English box after the band cleared English —
 * and the next save wrote it there for real.
 */
export function bagFrom(
  map: Partial<Record<Lang, string | null>> | null | undefined,
  legacy?: string | null,
): TranslationBag {
  const bag = emptyBag()
  for (const l of LOCALES) bag[l] = map?.[l] ?? ''
  if (legacy && !bagHasText(bag)) bag[DEFAULT_LOCALE] = legacy
  return bag
}

/**
 * The bag a form submits: every registered locale, a blank one as `null`.
 *
 * Every key, always — never omitted and never collapsed to a bare `null`:
 * - the API's setTranslations() MERGES, so an omitted locale keeps its old text
 *   and "clear the English title, save" returned 200 and changed nothing;
 * - a bare `null` is applied by Spatie to the REQUEST's locale only, so
 *   clearing the last language (a Polish-only bio, from an English browser)
 *   cleared `en` — already empty — and kept the Polish text.
 * Both were caught in review (#147, #149). A required field that is entirely
 * blank sends `{}` at the call site instead, so the API's `required` answers.
 */
export function compactBag(bag: TranslationBag): Record<Lang, string | null> {
  return Object.fromEntries(LOCALES.map(l => [l, bag[l].trim() !== '' ? bag[l] : null])) as Record<Lang, string | null>
}

/** True when any locale of the bag holds text. */
export function bagHasText(bag: TranslationBag): boolean {
  return LOCALES.some(l => bag[l].trim() !== '')
}

/**
 * A slug bag as a form submits it: a locale still auto-following its source
 * goes as null, so the API generates it.
 *
 * The preview a TranslatedSlugInput shows is only a guess — the server is the
 * one that can suffix past another record's slug in any language. Sending the
 * guess as an explicit value turned a clash into a 422 (#150's review).
 */
export function slugPayload(
  bag: TranslationBag,
  auto: Partial<Record<Lang, boolean>>,
): Record<Lang, string | null> {
  const out = compactBag(bag)
  for (const l of LOCALES) if (auto[l]) out[l] = null
  return out
}
