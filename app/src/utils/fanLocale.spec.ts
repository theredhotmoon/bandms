import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE } from '@/locales'
import { activeFanLocale, localeFromQuery, narrowToLocale, resolveFanLocale, setActiveFanLocale } from './fanLocale'

describe('narrowToLocale', () => {
  it('strips the region off a BCP-47 tag', () => {
    expect(narrowToLocale('pl-PL')).toBe('pl')
    expect(narrowToLocale('en-GB')).toBe('en')
  })

  it('is case- and whitespace-insensitive, because stored values are not curated', () => {
    expect(narrowToLocale(' PL ')).toBe('pl')
  })

  it('returns null for anything outside the registry, so the caller keeps looking', () => {
    expect(narrowToLocale('de-AT')).toBeNull()
    expect(narrowToLocale('')).toBeNull()
    expect(narrowToLocale(null)).toBeNull()
    expect(narrowToLocale(undefined)).toBeNull()
  })
})

describe('resolveFanLocale', () => {
  it('prefers ?lang= — the same precedence the API gives it', () => {
    expect(resolveFanLocale({
      search: '?lang=pl',
      stored: 'en',
      browser: ['en-US'],
    })).toBe('pl')
  })

  it('ignores an unsupported ?lang= rather than failing to the default', () => {
    // A stale link saying ?lang=de must not cost this fan their stored Polish.
    expect(resolveFanLocale({ search: '?lang=de', stored: 'pl', browser: ['en'] })).toBe('pl')
  })

  it('falls to the stored choice before the browser', () => {
    expect(resolveFanLocale({ search: '', stored: 'pl', browser: ['en-US'] })).toBe('pl')
  })

  it('walks the browser list in order, skipping locales we do not carry', () => {
    expect(resolveFanLocale({ browser: ['de-DE', 'pl-PL', 'en-US'] })).toBe('pl')
  })

  it('falls back to the registry default when nothing matches', () => {
    expect(resolveFanLocale({})).toBe(DEFAULT_LOCALE)
    expect(resolveFanLocale({ search: '', stored: null, browser: ['de', 'fr'] })).toBe(DEFAULT_LOCALE)
  })
})

describe('localeFromQuery', () => {
  // Only a `?lang=` value represents a *choice*, and only a choice may be
  // persisted: resolution reads the store before the browser list, so storing a
  // browser-derived value freezes it and a later browser change can never be
  // read again.
  it('reads a supported locale off the query', () => {
    expect(localeFromQuery('?lang=pl')).toBe('pl')
    expect(localeFromQuery('?foo=1&lang=en')).toBe('en')
  })

  it('is null for an absent, empty or unsupported value', () => {
    expect(localeFromQuery('')).toBeNull()
    expect(localeFromQuery(undefined)).toBeNull()
    expect(localeFromQuery('?lang=')).toBeNull()
    expect(localeFromQuery('?lang=de')).toBeNull()
  })
})

describe('activeFanLocale', () => {
  // One value shared by the chrome and the request headers. They used to be
  // derived separately — once at mount, and per request — and diverged whenever
  // only the query changed.
  it('is null until a fan page publishes one, and null again after', () => {
    expect(activeFanLocale()).toBeNull()
    setActiveFanLocale('pl')
    expect(activeFanLocale()).toBe('pl')
    setActiveFanLocale(null)
    expect(activeFanLocale()).toBeNull()
  })
})
