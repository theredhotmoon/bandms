import { DEFAULT_LOCALE, isLocale, LOCALES, type Lang } from '@/locales'

/**
 * Which language the fan-facing pages render in.
 *
 * The admin picks its language from a switcher and stores it in
 * `admin_ui_lang`. A fan never sees that switcher, so those pages rendered
 * whatever an admin had last chosen on that browser — in practice English,
 * and in the worst case a language the fan does not read because someone else
 * used the machine.
 *
 * This deliberately mirrors what the API already does. `SetLocale` (appended
 * globally in api/bootstrap/app.php) resolves `?lang=` first and falls back to
 * `Accept-Language`, so a browser reaching any endpoint already gets responses
 * in its own language. Resolving the chrome the same way is what makes the
 * page agree with the data on it; doing it differently is how you get a Polish
 * heading over an English validation message.
 *
 * `admin_ui_lang` is deliberately not read or written. A fan visiting
 * /account must not change the panel language for the admin who shares that
 * browser, and vice versa.
 */
export const FAN_LANG_STORAGE_KEY = 'fan_lang'

/**
 * Narrow a browser language tag to a registry locale.
 *
 * `navigator.language` is a BCP-47 tag — 'pl-PL', 'en-GB', 'de-AT' — so the
 * region has to come off before it can match. Returns null rather than a
 * default so the caller can keep looking down its list.
 */
export function narrowToLocale(tag: string | null | undefined): Lang | null {
  const base = (tag ?? '').trim().toLowerCase().split('-')[0]
  return isLocale(base) ? base : null
}

/**
 * The locale a mounted fan page settled on, or null when none is mounted.
 *
 * `withFanLocale` in api/fan.ts used to re-derive the locale from
 * `window.location.search` on every request while the chrome resolved once in
 * `onMounted`. The two agreed on a full page load and diverged the moment only
 * the query changed — Back/Forward between /account?lang=pl and ?lang=en reuses
 * the component instance, so the page stayed Polish while requests started
 * announcing English. That is the exact split this whole feature exists to
 * remove, so there is now one value and the header reads it.
 */
let active: Lang | null = null

/** Set by useFanLocale on mount and on every route change; cleared on unmount. */
export function setActiveFanLocale(locale: Lang | null): void {
  active = locale
}

/** Null outside a fan page, where the caller should resolve for itself. */
export function activeFanLocale(): Lang | null {
  return active
}

/**
 * The locale named by `?lang=`, or null.
 *
 * Split out because it is the only source that represents a *choice*. See the
 * note on writeStoredFanLocale.
 */
export function localeFromQuery(search: string | undefined): Lang | null {
  return narrowToLocale(new URLSearchParams(search ?? '').get('lang'))
}

/**
 * First match wins:
 *   1. `?lang=` on the URL — explicit, and what a link from the public site or
 *      a ticket email would carry. Same precedence the API gives it.
 *   2. a choice this fan made before, from storage.
 *   3. the browser's own preference list, in its own order.
 *   4. the registry default.
 */
export function resolveFanLocale(opts: {
  search?: string
  stored?: string | null
  browser?: readonly string[]
}): Lang {
  const fromQuery = localeFromQuery(opts.search)
  if (fromQuery) return fromQuery

  const fromStore = narrowToLocale(opts.stored)
  if (fromStore) return fromStore

  for (const tag of opts.browser ?? []) {
    const hit = narrowToLocale(tag)
    if (hit) return hit
  }

  return DEFAULT_LOCALE
}

/**
 * Read the fan's stored choice, guarded.
 *
 * `localStorage` throws — not returns null — in a private window or with site
 * data blocked, and a ticket link is exactly the sort of URL someone opens in
 * a private window. An unguarded read would blank the page.
 */
export function readStoredFanLocale(): string | null {
  try {
    return localStorage.getItem(FAN_LANG_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Remember an explicit choice, so it survives the next page.
 *
 * **Only ever called with a `?lang=` value.** It used to be called with
 * whatever `resolveFanLocale` returned, which quietly froze the browser's own
 * preference: resolution reads the store (step 2) *before* the browser list
 * (step 3), so a fan whose Chrome was English-only on their first visit had
 * `fan_lang=en` written, and switching Chrome to Polish afterwards could never
 * take effect — the page stayed English and, worse, started telling the server
 * so. Nothing the fan ever chose said English.
 *
 * Failing to write is harmless; the resolution above still works for this page.
 */
export function writeStoredFanLocale(locale: Lang): void {
  try {
    localStorage.setItem(FAN_LANG_STORAGE_KEY, locale)
  } catch {
    // Storage refused. The resolution above still works for this page.
  }
}

/** The locales a fan can be shown, for a future selector. */
export const FAN_LOCALES: readonly Lang[] = LOCALES
