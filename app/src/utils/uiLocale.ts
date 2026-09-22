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
