import { describe, it, expect } from 'vitest'
import { formatShortDate, formatDuration } from './formatDate'

describe('formatShortDate', () => {
  it('formats in the locale it is given', () => {
    // The whole reason this util exists: the same date reads differently per
    // locale, and three setlist files were hardcoding the English month.
    expect(formatShortDate('2026-05-08', 'en')).toContain('May')
    expect(formatShortDate('2026-05-08', 'pl')).not.toContain('May')
  })

  it('uses the Polish genitive, not the nominative', () => {
    // "8 maja", not "8 maj". This is why the helper asks for month: 'long' —
    // CLDR's abbreviated Polish May is the bare word "maj", so the short form
    // reads wrong for exactly one month of the year and looks perfect for the
    // other eleven.
    expect(formatShortDate('2026-05-08', 'pl')).toContain('maja')
    expect(formatShortDate('2026-09-08', 'pl')).toContain('września')
    expect(formatShortDate('2026-01-08', 'pl')).toContain('stycznia')
  })

  it('includes the day and the year', () => {
    const out = formatShortDate('2026-05-08', 'en')
    expect(out).toContain('8')
    expect(out).toContain('2026')
  })

  it('renders the calendar day, not the viewer time zone', () => {
    // A date-only value parses as UTC midnight. Formatted in the viewer's
    // zone, every admin west of Greenwich would see the day BEFORE — "May 7"
    // for an 8 May gig. This assertion is the one that would have caught it:
    // the test above passes in Warsaw and in UTC CI and fails in New York,
    // which is worse than no assertion because it reads as coverage.
    const TZ = process.env.TZ
    try {
      for (const tz of ['UTC', 'Europe/Warsaw', 'America/Los_Angeles', 'Pacific/Honolulu']) {
        process.env.TZ = tz
        expect(formatShortDate('2026-05-08', 'en'), tz).toBe('May 8, 2026')
      }
    } finally {
      process.env.TZ = TZ
    }
  })

  it('returns empty for null, undefined and empty string', () => {
    expect(formatShortDate(null, 'en')).toBe('')
    expect(formatShortDate(undefined, 'en')).toBe('')
    expect(formatShortDate('', 'en')).toBe('')
  })

  it('returns an unparseable value untouched rather than "Invalid Date"', () => {
    expect(formatShortDate('not-a-date', 'en')).toBe('not-a-date')
  })
})

describe('formatDuration', () => {
  it('pads the seconds', () => {
    expect(formatDuration(245)).toBe('4:05')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(3599)).toBe('59:59')
  })

  it('returns empty for null, undefined and zero', () => {
    expect(formatDuration(null)).toBe('')
    expect(formatDuration(undefined)).toBe('')
    expect(formatDuration(0)).toBe('')
  })
})
