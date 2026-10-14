import { describe, expect, it } from 'vitest'
import { firstInOrder } from './localeOrder'

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
