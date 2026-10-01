import { DEFAULT_LOCALE, type Lang } from '@/locales'

/**
 * Interface languages — the ones the admin panel and fan portal are themselves
 * translated into, i.e. those with a catalogue under `src/i18n/<code>/`.
 *
 * A separate list from `LOCALES` in `@/locales`, which is the band's CONTENT
 * languages. The two were one list until a third content language was tried:
 * adding it would also have offered it in the UI language switcher, with no
 * catalogue behind it, and vue-i18n would have silently rendered English while
 * the switcher claimed otherwise. Content in a language does not require the
 * admin to be translated into it.
 *
 * Always a subset of the content locales (`satisfies readonly Lang[]`): the fan
 * portal sends its locale to the API for emails, and the API only knows the
 * registry. Adding an interface language is a catalogue directory, an entry
 * here, and an entry in `messages` in `./index.ts` — which is typed against
 * this list, so forgetting either half is a compile error.
 */
export const UI_LOCALES = ['en', 'pl'] as const satisfies readonly Lang[]

export type UiLang = (typeof UI_LOCALES)[number]

export function isUiLocale(value: unknown): value is UiLang {
  return typeof value === 'string' && (UI_LOCALES as readonly string[]).includes(value)
}

/**
 * The registry default when it has a catalogue, otherwise the first interface
 * language. A content-only default (a band whose site defaults to a language
 * the admin is not translated into) must not leave the panel untranslatable.
 */
export const DEFAULT_UI_LOCALE: UiLang = isUiLocale(DEFAULT_LOCALE) ? DEFAULT_LOCALE : UI_LOCALES[0]
