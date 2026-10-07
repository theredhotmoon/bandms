import { describe, expect, it } from 'vitest'
import { parseLocaleView, visibleFor } from './editorLocales'

describe('parseLocaleView', () => {
  it('accepts "all" and any registry locale', () => {
    expect(parseLocaleView('all')).toBe('all')
    expect(parseLocaleView('pl')).toBe('pl')
  })

  it('falls back to "all" for anything the registry does not know', () => {
    expect(parseLocaleView('de')).toBe('all')
    expect(parseLocaleView(null)).toBe('all')
    expect(parseLocaleView(42)).toBe('all')
  })
})

describe('visibleFor', () => {
  it('returns the full content order for "all"', () => {
    expect(visibleFor('all', ['pl', 'en'])).toEqual(['pl', 'en'])
  })

  it('narrows to the one chosen locale without reordering', () => {
    expect(visibleFor('en', ['pl', 'en'])).toEqual(['en'])
  })

  it('returns nothing rather than throwing when the choice is absent from the order', () => {
    expect(visibleFor('en', ['pl'])).toEqual([])
  })
})
