import { describe, it, expect } from 'vitest'
import {
  LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  nativeName,
  shortLabel,
  emptyBag,
  bagFrom,
  compactBag,
} from './locales'

describe('admin locale registry', () => {
  it('lists the supported locales in declaration order', () => {
    expect(LOCALES).toEqual(['en', 'pl'])
  })

  it('names a default that is itself supported', () => {
    expect(DEFAULT_LOCALE).toBe('en')
    expect(LOCALES).toContain(DEFAULT_LOCALE)
  })

  it('narrows an arbitrary string to a Lang', () => {
    expect(isLocale('pl')).toBe(true)
    expect(isLocale('de')).toBe(false)
  })

  it('maps a locale to the name it calls itself', () => {
    expect(nativeName('pl')).toBe('Polski')
  })

  // The editors render a per-locale tab strip; the short label is what goes on
  // the tab.
  it('maps a locale to a short uppercase tab label', () => {
    expect(shortLabel('en')).toBe('EN')
    expect(shortLabel('pl')).toBe('PL')
  })

  // Admin forms build a {en: '', pl: ''} draft before the user types. Built
  // from the registry so a new locale gets an input with no edit to each form.
  it('builds an empty translation bag with one key per locale', () => {
    expect(emptyBag()).toEqual({ en: '', pl: '' })
  })

  it('returns a fresh bag each call, not a shared reference', () => {
    const a = emptyBag()
    a.en = 'typed'
    expect(emptyBag().en).toBe('')
  })
})

describe('bagFrom / compactBag', () => {
  it('fills every registered locale, missing ones blank', () => {
    expect(bagFrom({ pl: 'Tytuł' })).toEqual({ en: '', pl: 'Tytuł' })
    expect(bagFrom(null)).toEqual({ en: '', pl: '' })
  })

  it('puts a legacy plain string under the default locale only when it is empty', () => {
    expect(bagFrom({}, 'Old title')).toEqual({ en: 'Old title', pl: '' })
    expect(bagFrom({ en: 'New' }, 'Old title')).toEqual({ en: 'New', pl: '' })
  })

  // A Polish-only title must not be sent with an empty English key — that
  // shape is what made English the implicit primary language.
  it('omits blank locales and returns null for an empty bag', () => {
    expect(compactBag({ en: '  ', pl: 'Tytuł' })).toEqual({ pl: 'Tytuł' })
    expect(compactBag({ en: '', pl: '' })).toBeNull()
  })
})
