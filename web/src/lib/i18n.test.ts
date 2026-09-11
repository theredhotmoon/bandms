import { describe, it, expect } from 'vitest'
import { postSlug, formatGenreKicker, splitCommaList, formatEventDates } from './i18n'

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
