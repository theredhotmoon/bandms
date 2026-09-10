import { describe, it, expect } from 'vitest'
import { postSlug } from './i18n'

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
