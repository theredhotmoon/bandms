import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cookieDomains, disableGoogleAnalytics, loadGoogleAnalytics } from './analytics'

const ID = 'G-TEST123'

/**
 * gtag.js is a black box that stays silent — no error, no request — when
 * either of these is wrong, which is how a dead tag shipped for two months
 * (docs/ga4-tracking-investigation.md). Both are properties of what *we*
 * hand it, so both can be pinned without Google.
 */
describe('loadGoogleAnalytics', () => {
  let win: Record<string, unknown>
  let scripts: Array<Record<string, unknown>>

  beforeEach(() => {
    win = {}
    scripts = []
    vi.stubGlobal('window', win)
    vi.stubGlobal('document', {
      cookie: '',
      getElementById: (id: string) => scripts.find(s => s.id === id) ?? null,
      createElement: () => ({}),
      head: { appendChild: (s: Record<string, unknown>) => scripts.push(s) },
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('queues commands as Arguments objects, the only shape gtag.js executes', () => {
    loadGoogleAnalytics(ID)

    const queue = win.dataLayer as unknown[]
    expect(queue).toHaveLength(2)
    for (const entry of queue) {
      // A real array is treated as data-layer *data* and silently ignored.
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
    }
    expect(Array.from(queue[1] as ArrayLike<unknown>)).toEqual(['config', ID])
  })

  it('clears a kill switch set earlier on the page', () => {
    disableGoogleAnalytics(ID)
    expect(win[`ga-disable-${ID}`]).toBe(true)

    loadGoogleAnalytics(ID)

    expect(win[`ga-disable-${ID}`]).toBe(false)
  })

  it('re-enables and re-configures an already-loaded tag when consent is granted again', () => {
    loadGoogleAnalytics(ID)
    disableGoogleAnalytics(ID)

    loadGoogleAnalytics(ID)

    expect(win[`ga-disable-${ID}`]).toBe(false)
    expect(scripts).toHaveLength(1)
    // The withdrawal cleared the cookies, so the tag is configured afresh —
    // which is also what counts this page for the visitor who said yes.
    const queue = win.dataLayer as ArrayLike<unknown>[]
    expect(queue).toHaveLength(3)
    expect(Array.from(queue[2]!)).toEqual(['config', ID])
  })

  it('does not configure twice when called again without a withdrawal', () => {
    loadGoogleAnalytics(ID)
    loadGoogleAnalytics(ID)

    expect(win.dataLayer as unknown[]).toHaveLength(2)
  })
})

describe('disableGoogleAnalytics', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('expires _ga cookies on the host and on every parent domain, and leaves others alone', () => {
    const writes: string[] = []
    vi.stubGlobal('window', {})
    vi.stubGlobal('location', { hostname: 'www.skankingstorks.band' })
    vi.stubGlobal('document', {
      get cookie() { return '_ga=GA1.1.1; theme=dark; _ga_ABC=GS1.1' },
      set cookie(value: string) { writes.push(value) },
    })

    disableGoogleAnalytics(ID)

    // gtag sets _ga on `.skankingstorks.band`; a write with no Domain cannot
    // expire that, so withdrawal would leave the identifier for two years.
    expect(writes.some(w => w.startsWith('_ga=;') && w.includes('domain=.skankingstorks.band;'))).toBe(true)
    expect(writes.some(w => w.startsWith('_ga_ABC=;') && w.includes('domain=.skankingstorks.band;'))).toBe(true)
    expect(writes.some(w => w.startsWith('_ga=;') && !w.includes('domain='))).toBe(true)
    expect(writes.some(w => w.startsWith('theme'))).toBe(false)
  })
})

describe('cookieDomains', () => {
  it('lists host-only first, then each parent with at least two labels', () => {
    expect(cookieDomains('www.skankingstorks.band')).toEqual([
      '',
      ' domain=.www.skankingstorks.band;',
      ' domain=.skankingstorks.band;',
    ])
  })

  it('is host-only for a single-label host', () => {
    expect(cookieDomains('localhost')).toEqual([''])
    expect(cookieDomains('')).toEqual([''])
  })
})
