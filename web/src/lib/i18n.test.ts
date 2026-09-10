import { describe, it, expect } from 'vitest'
import { postSlug, formatGenreKicker, splitCommaList } from './i18n'

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
