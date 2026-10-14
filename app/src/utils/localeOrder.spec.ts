import { describe, expect, it } from 'vitest'
import { firstInOrder, tagLabel, tagTerms } from './localeOrder'

describe('firstInOrder', () => {
  it('reads the first language in the band order, not the default locale', () => {
    expect(firstInOrder({ en: 'Live', pl: 'Na żywo' }, ['pl', 'en'])).toBe('Na żywo')
    expect(firstInOrder({ en: 'Live', pl: 'Na żywo' }, ['en', 'pl'])).toBe('Live')
  })

  it('falls through to the next language when the first is blank or whitespace', () => {
    expect(firstInOrder({ en: 'Live', pl: null }, ['pl', 'en'])).toBe('Live')
    expect(firstInOrder({ en: 'Live', pl: '   ' }, ['pl', 'en'])).toBe('Live')
    expect(firstInOrder({ en: 'Live' }, ['pl', 'en'])).toBe('Live')
  })

  it('returns null when nothing is filled, so the caller picks the placeholder', () => {
    expect(firstInOrder({ en: '', pl: null }, ['pl', 'en'])).toBeNull()
    expect(firstInOrder(undefined, ['pl', 'en'])).toBeNull()
  })
})

describe('tagLabel', () => {
  const tag = { name: 'Live', translations: { name: { en: 'Live', pl: 'Na żywo' } } }

  it("shows the band's first language, not the request-language name", () => {
    expect(tagLabel(tag, ['pl', 'en'])).toBe('Na żywo')
    expect(tagLabel(tag, ['en', 'pl'])).toBe('Live')
  })

  it('falls back to the resolved name when an embed carries no translations', () => {
    expect(tagLabel({ name: 'Live' }, ['pl', 'en'])).toBe('Live')
  })
})

describe('tagTerms', () => {
  it('covers every language of the name and slug, lowercased, once each', () => {
    const tag = {
      name: 'Live', slug: 'live',
      translations: { name: { en: 'Live', pl: 'Na żywo' }, slug: { en: 'live', pl: 'na-zywo' } },
    }
    expect(tagTerms(tag).sort()).toEqual(['live', 'na żywo', 'na-zywo'])
  })

  it('does not throw on a tag with no translations', () => {
    expect(tagTerms({ name: 'Live', slug: 'live' })).toEqual(['live'])
    expect(tagTerms({ name: 'Live', translations: null })).toEqual(['live'])
  })
})
