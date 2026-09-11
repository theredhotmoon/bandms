import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consentStatus,
  denyConsent,
  grantConsent,
  loadStoredConsent,
  resetConsent,
  resolveStoredConsent,
} from './consent'

/**
 * vitest runs `web/` in a Node environment (see vitest.config.ts), which has
 * no `localStorage` global — the same trap noted in CLAUDE.md for app/'s
 * useAuth. consent.ts's own try/catch already tolerates that (a ReferenceError
 * on an undeclared global is caught like any other), which the "no storage at
 * all" tests below rely on. Everything else needs a real-ish store, stubbed in.
 */
function stubLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  return store
}

describe('resolveStoredConsent', () => {
  it('returns unknown for no stored decision', () => {
    expect(resolveStoredConsent(null)).toBe('unknown')
  })

  it('honours a stored grant', () => {
    expect(resolveStoredConsent({ status: 'granted', decidedAt: new Date().toISOString() })).toBe('granted')
  })

  it('honours a stored denial', () => {
    expect(resolveStoredConsent({ status: 'denied', decidedAt: new Date().toISOString() })).toBe('denied')
  })

  it('expires a stored choice older than 6 months', () => {
    const sevenMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 7).toISOString()
    expect(resolveStoredConsent({ status: 'granted', decidedAt: sevenMonthsAgo })).toBe('unknown')
  })

  it('honours a choice just inside the 6-month window', () => {
    const fiveMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 5).toISOString()
    expect(resolveStoredConsent({ status: 'granted', decidedAt: fiveMonthsAgo })).toBe('granted')
  })

  it('treats an unparseable decidedAt as expired', () => {
    expect(resolveStoredConsent({ status: 'granted', decidedAt: 'not-a-date' })).toBe('unknown')
  })
})

describe('consent store, with localStorage available', () => {
  beforeEach(() => {
    stubLocalStorage()
    consentStatus.set('unknown')
  })

  it('starts unknown when nothing was ever recorded', () => {
    loadStoredConsent()
    expect(consentStatus.get()).toBe('unknown')
  })

  it('grantConsent persists and updates the atom', () => {
    grantConsent()
    expect(consentStatus.get()).toBe('granted')

    consentStatus.set('unknown')
    loadStoredConsent()
    expect(consentStatus.get()).toBe('granted')
  })

  it('denyConsent persists and updates the atom', () => {
    denyConsent()
    expect(consentStatus.get()).toBe('denied')

    consentStatus.set('unknown')
    loadStoredConsent()
    expect(consentStatus.get()).toBe('denied')
  })

  it('resetConsent clears a prior decision', () => {
    grantConsent()
    resetConsent()
    expect(consentStatus.get()).toBe('unknown')

    loadStoredConsent()
    expect(consentStatus.get()).toBe('unknown')
  })

  it('treats corrupt stored JSON as no decision', () => {
    localStorage.setItem('bandms:consent', '{not json')
    loadStoredConsent()
    expect(consentStatus.get()).toBe('unknown')
  })

  it('treats an unrecognised stored status as no decision', () => {
    localStorage.setItem('bandms:consent', JSON.stringify({ status: 'maybe' }))
    loadStoredConsent()
    expect(consentStatus.get()).toBe('unknown')
  })
})

describe('consent store, with no localStorage at all', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', undefined)
    consentStatus.set('unknown')
  })

  it('does not throw, and falls back to unknown', () => {
    expect(() => loadStoredConsent()).not.toThrow()
    expect(consentStatus.get()).toBe('unknown')
  })

  it('grant/deny/reset do not throw even though nothing persists', () => {
    expect(() => grantConsent()).not.toThrow()
    expect(consentStatus.get()).toBe('granted')
    expect(() => resetConsent()).not.toThrow()
    expect(consentStatus.get()).toBe('unknown')
  })
})
