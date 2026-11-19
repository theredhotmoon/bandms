import { describe, it, expect } from 'vitest'
import {
  isExcludedPath, isDue, selectBlocks, readSeen, writeSeen, dropPastConcerts, shouldMarkSeen, storageWritable,
  type WelcomeConfig, type WelcomeBlock,
} from './welcome'

const cfg = (over: Partial<WelcomeConfig> = {}, geo: Partial<WelcomeConfig['geo']> = {}): WelcomeConfig => ({
  blocks: ['concerts', 'news', 'newsletter', 'account'],
  concert_count: 2,
  frequency: 'interval',
  reshow_days: 90,
  campaign: 1,
  ...over,
  geo: { enabled: false, radius_km: 150, far_visitors: 'hide_gigs', ...geo },
})
const all: Record<WelcomeBlock, boolean> = { concerts: true, news: true, newsletter: true, account: true }
const DAY = 86_400_000
const now = new Date('2026-11-19T12:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString()

describe('isExcludedPath', () => {
  it.each(['/rider/abc', '/en/privacy', '/pl/privacy/', '/account', '/newsletter/confirm/t', '/tickets/x'])('excludes %s', p => {
    expect(isExcludedPath(p)).toBe(true)
  })
  it.each(['/en', '/en/', '/en/concerts', '/pl/kontakt'])('allows %s', p => {
    expect(isExcludedPath(p)).toBe(false)
  })
})

describe('isDue', () => {
  it('is due when never seen', () => expect(isDue(null, cfg(), now)).toBe(true))
  it('interval: 89 days ago is not due, 91 is', () => {
    expect(isDue({ seenAt: ago(89), campaign: 1 }, cfg(), now)).toBe(false)
    expect(isDue({ seenAt: ago(91), campaign: 1 }, cfg(), now)).toBe(true)
  })
  it('once: never again in the same campaign', () => {
    expect(isDue({ seenAt: ago(365 * 3), campaign: 1 }, cfg({ frequency: 'once' }), now)).toBe(false)
  })
  it('a new campaign is due in both modes', () => {
    expect(isDue({ seenAt: ago(1), campaign: 1 }, cfg({ campaign: 2 }), now)).toBe(true)
    expect(isDue({ seenAt: ago(1), campaign: 1 }, cfg({ campaign: 2, frequency: 'once' }), now)).toBe(true)
  })
  it('an unparseable date is due', () => {
    expect(isDue({ seenAt: 'nope', campaign: 1 }, cfg(), now)).toBe(true)
  })
})

describe('selectBlocks', () => {
  const up = [10, 11, 12]
  it('geo off: first concert_count upcoming', () => {
    expect(selectBlocks(cfg(), all, null, up)).toEqual({ blocks: ['concerts', 'news', 'newsletter', 'account'], concertIds: [10, 11] })
  })
  it('located near: only near ids, capped', () => {
    const r = selectBlocks(cfg({}, { enabled: true }), all, { located: true, concertIds: [12, 11, 10] }, up)
    expect(r?.concertIds).toEqual([12, 11])
  })
  it('located far + hide_gigs drops concerts, keeps others', () => {
    const r = selectBlocks(cfg({}, { enabled: true }), all, { located: true, concertIds: [] }, up)
    expect(r).toEqual({ blocks: ['news', 'newsletter', 'account'], concertIds: [] })
  })
  it('located far + no_screen: no screen', () => {
    expect(selectBlocks(cfg({}, { enabled: true, far_visitors: 'no_screen' }), all, { located: true, concertIds: [] }, up)).toBeNull()
  })
  it('located: drops near ids the page does not know, keeping server order', () => {
    const r = selectBlocks(cfg({}, { enabled: true }), all, { located: true, concertIds: [99, 12] }, up)
    expect(r?.concertIds).toEqual([12])
  })
  it('located, only unknown near ids + no_screen: no screen', () => {
    expect(selectBlocks(cfg({}, { enabled: true, far_visitors: 'no_screen' }), all, { located: true, concertIds: [99] }, up)).toBeNull()
  })
  it('located, only unknown near ids + hide_gigs: no concerts block', () => {
    const r = selectBlocks(cfg({}, { enabled: true }), all, { located: true, concertIds: [99] }, up)
    expect(r).toEqual({ blocks: ['news', 'newsletter', 'account'], concertIds: [] })
  })
  it('not located falls back to upcoming', () => {
    const r = selectBlocks(cfg({}, { enabled: true }), all, { located: false, concertIds: [] }, up)
    expect(r?.concertIds).toEqual([10, 11])
  })
  it('all blocks unavailable: null', () => {
    expect(selectBlocks(cfg(), { concerts: false, news: false, newsletter: false, account: false }, null, up)).toBeNull()
  })
  it('far + hide_gigs with only concerts enabled: null', () => {
    expect(selectBlocks(cfg({ blocks: ['concerts'] }, { enabled: true }), all, { located: true, concertIds: [] }, up)).toBeNull()
  })
  it('concerts block with no upcoming gigs is dropped', () => {
    const r = selectBlocks(cfg(), all, null, [])
    expect(r?.blocks).toEqual(['news', 'newsletter', 'account'])
  })
  it('order follows cfg.blocks', () => {
    const r = selectBlocks(cfg({ blocks: ['account', 'news'] }), all, null, up)
    expect(r?.blocks).toEqual(['account', 'news'])
  })
})

describe('readSeen / writeSeen', () => {
  const mem = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
  }
  it('null storage is unavailable', () => expect(readSeen(null)).toBe('unavailable'))
  it('throwing getItem is unavailable', () => {
    expect(readSeen({ ...mem(), getItem: () => { throw new Error('x') } })).toBe('unavailable')
  })
  it('corrupt JSON is null', () => {
    const s = mem(); s.setItem('bandms:welcome', '{nope')
    expect(readSeen(s)).toBeNull()
  })
  it('round-trips', () => {
    const s = mem(); writeSeen(s, 3, now)
    expect(readSeen(s)).toEqual({ seenAt: now.toISOString(), campaign: 3 })
  })
  it('writeSeen swallows storage errors', () => {
    expect(() => writeSeen({ ...mem(), setItem: () => { throw new Error('quota') } }, 1, now)).not.toThrow()
    expect(() => writeSeen(null, 1, now)).not.toThrow()
  })
})

describe('dropPastConcerts', () => {
  const gig = (id: number, isoDate: string) => ({ id, isoDate })
  // Local noon, so the local calendar date is 2026-11-19 in any time zone.
  const today = new Date(2026, 10, 19, 12, 0, 0)
  it('drops shows before today, keeps today and later, preserving order', () => {
    const list = [gig(1, '2026-11-18'), gig(2, '2026-11-19'), gig(3, '2026-12-01'), gig(4, '2025-01-01')]
    expect(dropPastConcerts(list, today).map(c => c.id)).toEqual([2, 3])
  })
  it('uses the local calendar date, not UTC', () => {
    // 00:30 local on the 19th: in a zone east of UTC that is still the 18th in UTC.
    const early = new Date(2026, 10, 19, 0, 30, 0)
    expect(dropPastConcerts([gig(1, '2026-11-19'), gig(2, '2026-11-18')], early).map(c => c.id)).toEqual([1])
  })
  it('keeps a show whose date it cannot read', () => {
    expect(dropPastConcerts([gig(1, '')], today).map(c => c.id)).toEqual([1])
  })
})

describe('merch return pages', () => {
  it('excludes /merch/success and /merch/cancel', () => {
    for (const p of ['/merch/success', '/merch/success/', '/merch/cancel', '/merch/cancel/']) {
      expect(isExcludedPath(p), p).toBe(true)
    }
    expect(isExcludedPath('/merch/')).toBe(false)
  })
})

describe('shouldMarkSeen', () => {
  it('marks a shown screen and a finished lookup, never an undue screen', () => {
    expect(shouldMarkSeen({ blocks: [], concertIds: [] }, false)).toBe(true)
    expect(shouldMarkSeen(null, true)).toBe(true)
    expect(shouldMarkSeen(null, false)).toBe(false)
  })
})

describe('storageWritable', () => {
  it('is false for no storage or a storage whose setItem throws', () => {
    expect(storageWritable(null)).toBe(false)
    expect(storageWritable({ setItem() { throw new Error('ro') }, removeItem() {} })).toBe(false)
  })
  it('is true for a working storage and leaves no probe behind', () => {
    const m = new Map<string, string>()
    expect(storageWritable({ setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) })).toBe(true)
    expect(m.size).toBe(0)
  })
})
