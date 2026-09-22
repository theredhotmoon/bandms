import { describe, it, expect } from 'vitest'
import { UI_LANG_STORAGE_KEY, resolveStoredLocale, polishPluralIndex } from './uiLocale'

describe('UI_LANG_STORAGE_KEY', () => {
  // Sharing `site_lang` would make a chrome switch refetch every record in the
  // other content locale. The two axes are independent by design.
  it('is distinct from the content-language key', () => {
    expect(UI_LANG_STORAGE_KEY).toBe('admin_ui_lang')
    expect(UI_LANG_STORAGE_KEY).not.toBe('site_lang')
  })
})

describe('resolveStoredLocale', () => {
  it('accepts a locale the registry knows', () => {
    expect(resolveStoredLocale('pl')).toBe('pl')
  })

  it('falls back to the default for an unknown value', () => {
    expect(resolveStoredLocale('de')).toBe('en')
  })

  it('falls back to the default when nothing is stored', () => {
    expect(resolveStoredLocale(null)).toBe('en')
  })
})

describe('polishPluralIndex', () => {
  it('returns the singular form for exactly one', () => {
    expect(polishPluralIndex(1)).toBe(0)
  })

  it('returns the few form for 2-4', () => {
    expect(polishPluralIndex(2)).toBe(1)
    expect(polishPluralIndex(4)).toBe(1)
  })

  it('returns the many form for 5 and above', () => {
    expect(polishPluralIndex(5)).toBe(2)
  })

  it('returns the many form for zero', () => {
    expect(polishPluralIndex(0)).toBe(2)
  })

  // 12-14 are the exception to the "ends in 2-4" rule: 12 koncertow, not koncerty.
  it('returns the many form for the teens', () => {
    expect(polishPluralIndex(12)).toBe(2)
    expect(polishPluralIndex(13)).toBe(2)
    expect(polishPluralIndex(14)).toBe(2)
  })

  it('applies the decade rule above the teens', () => {
    expect(polishPluralIndex(22)).toBe(1)
    expect(polishPluralIndex(25)).toBe(2)
    expect(polishPluralIndex(112)).toBe(2)
    expect(polishPluralIndex(122)).toBe(1)
  })
})
