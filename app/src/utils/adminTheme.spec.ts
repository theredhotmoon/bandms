import { describe, expect, it } from 'vitest'
import { DEFAULT_ADMIN_THEME, isAdminTheme, resolveStoredTheme } from './adminTheme'

describe('resolveStoredTheme', () => {
  it('keeps a known theme', () => {
    expect(resolveStoredTheme('light')).toBe('light')
    expect(resolveStoredTheme('dark')).toBe('dark')
  })

  it('falls back to dark for a missing or unknown value', () => {
    expect(DEFAULT_ADMIN_THEME).toBe('dark')
    expect(resolveStoredTheme(null)).toBe('dark')
    expect(resolveStoredTheme('sepia')).toBe('dark')
    expect(resolveStoredTheme('')).toBe('dark')
  })
})

describe('isAdminTheme', () => {
  it('rejects non-strings', () => {
    expect(isAdminTheme(undefined)).toBe(false)
    expect(isAdminTheme(1)).toBe(false)
  })
})
