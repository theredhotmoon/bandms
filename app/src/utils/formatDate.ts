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
  // `month: 'long'`, not 'short'. Polish dates take the genitive — "8 maja",
  // not "8 maj" — and CLDR's abbreviated form gives the nominative for May
  // specifically, because the Polish abbreviation for that month *is* the
  // whole word. Eleven months would have looked fine and the twelfth would
  // have read wrong, which is the worst kind of bug to ship: invisible to
  // anyone testing in January.
  //
  // This also changes the English rendering: the hand-rolled version these
  // helpers replaced produced "08 May 2026", and `en` through Intl gives
  // "May 8, 2026". That is what `en` means to the platform, and delegating
  // the choice is the point of the change.
  //
  // `timeZone: 'UTC'` is load-bearing, not tidiness. These are date-only
  // values — a gig date, a photo's taken_at day — and `new Date('2026-05-08')`
  // parses as UTC midnight. Rendering that in the viewer's zone shows the day
  // BEFORE for every admin at a negative offset: "May 7" for a 8 May gig,
  // across the setlist sidebar, the concert picker and every setlist.fm row.
  // The hand-rolled formatters this replaced split the string and were
  // structurally incapable of shifting, so the bug arrived with the helper.
  return parsed.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** `245` → `4:05`. Seconds are data; the colon is not copy in any locale. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
