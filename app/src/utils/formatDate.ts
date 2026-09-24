/**
 * Short date formatting for the admin, in the chrome locale.
 *
 * Three setlist files each carried their own
 * `['Jan','Feb',…,'Dec']` array and built `${day} ${mon} ${year}` by hand.
 * That is three copies of a translation table for something the platform
 * already knows, and it would have needed a fourth for every new locale.
 *
 * `Intl` is passed the locale rather than reading it, because this is a util:
 * `app/vitest.config.ts` runs `environment: 'node'`, so anything importing a
 * composable here would die on `localStorage.getItem is not a function`. The
 * caller has the locale from `useI18n()` and hands it over.
 */
export function formatShortDate(date: string | null | undefined, locale: string): string {
  if (!date) return ''
  const parsed = new Date(date)
  // An unparseable string is a data problem, not a formatting one — return it
  // untouched rather than rendering "Invalid Date" at the reader.
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** `245` → `4:05`. Seconds are data; the colon is not copy in any locale. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
