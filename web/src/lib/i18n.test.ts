import { describe, it, expect } from 'vitest'
import { postSlug, formatGenreKicker, splitCommaList, formatEventDates, fmtDate, fmtDateShort, fmtDateParts } from './i18n'

describe('postSlug', () => {
  it('uses slug_en for the en locale', () => {
    expect(postSlug({ slug_en: 'brass-tour-2026', slug_pl: 'trasa-2026' }, 'en')).toBe('brass-tour-2026')
  })

  it('uses slug_pl for the pl locale when present', () => {
    expect(postSlug({ slug_en: 'brass-tour-2026', slug_pl: 'trasa-2026' }, 'pl')).toBe('trasa-2026')
  })

  it('falls back to slug_en for pl when the post has no Polish title/slug', () => {
    expect(postSlug({ slug_en: 'brass-tour-2026', slug_pl: null }, 'pl')).toBe('brass-tour-2026')
  })

  it('falls back to slug_en for pl when slug_pl is an empty string', () => {
    expect(postSlug({ slug_en: 'brass-tour-2026', slug_pl: '' }, 'pl')).toBe('brass-tour-2026')
  })
})

describe('splitCommaList', () => {
  it('splits, trims and drops empty entries', () => {
    expect(splitCommaList('Ska ,  Ska-Jazz ,Rocksteady,')).toEqual(['Ska', 'Ska-Jazz', 'Rocksteady'])
  })

  it('returns an empty array for null/undefined/empty', () => {
    expect(splitCommaList(null)).toEqual([])
    expect(splitCommaList(undefined)).toEqual([])
    expect(splitCommaList('')).toEqual([])
  })
})

describe('formatGenreKicker', () => {
  it('joins comma-separated genres with a middle dot, uppercased', () => {
    expect(formatGenreKicker('Ska, Ska-Jazz, Rocksteady')).toBe('SKA · SKA-JAZZ · ROCKSTEADY')
  })

  it('trims stray whitespace around each entry', () => {
    expect(formatGenreKicker('Ska ,  Ska-Jazz ,Rocksteady')).toBe('SKA · SKA-JAZZ · ROCKSTEADY')
  })

  it('drops empty entries from a trailing comma', () => {
    expect(formatGenreKicker('Ska, Ska-Jazz,')).toBe('SKA · SKA-JAZZ')
  })

  it('returns a single genre unchanged but uppercased', () => {
    expect(formatGenreKicker('Ska')).toBe('SKA')
  })

  it('returns null for an empty string', () => {
    expect(formatGenreKicker('')).toBeNull()
  })

  it('returns null for null', () => {
    expect(formatGenreKicker(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatGenreKicker(undefined)).toBeNull()
  })

  it('returns null when the field is only commas and whitespace', () => {
    expect(formatGenreKicker(' , , ')).toBeNull()
  })
})

describe('fmtDateParts', () => {
  it('formats the month abbreviation in English by default', () => {
    expect(fmtDateParts('2026-09-10')).toEqual({ day: '10', mo: 'Sept', yr: 2026 })
  })

  // ConcertsSection.astro and pages/[lang]/index.astro used to reimplement
  // this with a hardcoded 'en-GB' locale, so a Polish gig row showed "Sep"
  // instead of "wrz" — this pins the fix.
  it('formats the month abbreviation in Polish when lang is pl', () => {
    expect(fmtDateParts('2026-09-10', 'pl').mo).toBe('wrz')
  })

  it('pads a single-digit day with a leading zero', () => {
    expect(fmtDateParts('2026-09-05').day).toBe('05')
  })
})

// `posts.published_at`/`created_at` are full ISO timestamps
// ('2026-09-14T20:01:32.000000Z'), not date-only strings. Every date helper used
// to unconditionally append 'T00:00:00' before parsing — the date-only guard
// (see formatEventDates) — which turned a timestamp into garbage and rendered
// the whole news section's dates as "NaN undefined NaN".
describe('parsing full ISO timestamps (posts.published_at / created_at)', () => {
  const ts = '2026-09-14T20:01:32.000000Z'

  /** Run `fn` with the process pinned to `tz`, restoring it afterwards. */
  function inTimeZone(tz: string, fn: () => void) {
    const original = process.env.TZ
    process.env.TZ = tz
    try { fn() } finally { process.env.TZ = original }
  }

  it('fmtDateParts yields a real day/month/year for a timestamp', () => {
    inTimeZone('UTC', () => {
      expect(fmtDateParts(ts)).toEqual({ day: '14', mo: 'Sept', yr: 2026 })
    })
  })

  it('fmtDate / fmtDateShort format a timestamp', () => {
    inTimeZone('UTC', () => {
      expect(fmtDate(ts)).toBe('14 September 2026')
      expect(fmtDateShort(ts)).toBe('14 Sept 2026')
    })
  })

  it('fmtDate formats in Polish when lang is pl', () => {
    inTimeZone('UTC', () => {
      expect(fmtDate(ts, 'pl')).toBe('14 września 2026')
    })
  })

  it('fmtDate still formats a date-only string, and does not shift it west of UTC', () => {
    inTimeZone('America/New_York', () => {
      expect(fmtDate('2099-01-10')).toBe('10 January 2099')
      expect(fmtDateShort('2099-01-10')).toBe('10 Jan 2099')
    })
  })

  // The admin's published_at is a datetime-local stored as typed, with the
  // server on UTC — so the calendar day the band typed is the timestamp's UTC
  // date. NewsFilter.vue is a client:idle island and formats the same value at
  // build (UTC container) and again in the visitor's browser; a zone-dependent
  // result would flip a 22:30 post to the next day for a Warsaw visitor, and
  // disagree with the SSR-only homepage row and article header for that post.
  it('formats a timestamp by its UTC calendar day whatever zone the runtime is in', () => {
    const lateEvening = '2026-09-14T22:30:00.000000Z'
    const earlyMorning = '2026-09-14T01:30:00.000000Z'
    for (const tz of ['Europe/Warsaw', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC']) {
      inTimeZone(tz, () => {
        expect(fmtDateShort(lateEvening), tz).toBe('14 Sept 2026')
        expect(fmtDateShort(earlyMorning), tz).toBe('14 Sept 2026')
        expect(fmtDateParts(lateEvening).day, tz).toBe('14')
        expect(fmtDateParts(earlyMorning).day, tz).toBe('14')
      })
    }
  })
})

describe('formatEventDates', () => {
  it('returns empty string when no concert is linked', () => {
    expect(formatEventDates([], 'range')).toBe('')
  })

  it('formats a single date without a range', () => {
    expect(formatEventDates(['2026-05-03'], 'range')).toBe('3 May 2026')
  })

  it('collapses consecutive dates in the same month into a range', () => {
    expect(formatEventDates(['2026-05-03', '2026-05-05'], 'range')).toBe('3 – 5 May 2026')
  })

  it('spans a range across months', () => {
    expect(formatEventDates(['2026-04-28', '2026-05-02'], 'range')).toBe('28 April – 2 May 2026')
  })

  it('lists every date individually when display is "list"', () => {
    expect(formatEventDates(['2026-06-02', '2026-06-01'], 'list')).toBe('1 June 2026, 2 June 2026')
  })

  it('sorts unordered dates before formatting a range', () => {
    expect(formatEventDates(['2026-06-05', '2026-06-01'], 'range')).toBe('1 – 5 June 2026')
  })

  // Date-only strings ('2099-01-10') parse as UTC midnight, which is still
  // the previous day in a timezone west of UTC — this pins the same guard
  // ConcertDetail.astro already relies on (new Date(date + 'T00:00:00')).
  it('does not shift the date back a day in a timezone west of UTC', () => {
    const original = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      expect(formatEventDates(['2099-01-10'], 'range')).toContain('10')
      expect(formatEventDates(['2099-01-10'], 'range')).not.toContain('9 January')
    } finally {
      process.env.TZ = original
    }
  })
})
