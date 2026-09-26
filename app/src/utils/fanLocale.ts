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
  const fromQuery = narrowToLocale(new URLSearchParams(opts.search ?? '').get('lang'))
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

/** Remember it, so the choice survives the next page. Failing to is harmless. */
export function writeStoredFanLocale(locale: Lang): void {
  try {
    localStorage.setItem(FAN_LANG_STORAGE_KEY, locale)
  } catch {
    // Storage refused. The resolution above still works for this page.
  }
}

/** The locales a fan can be shown, for a future selector. */
export const FAN_LOCALES: readonly Lang[] = LOCALES
