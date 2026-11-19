import { describe, it, expect } from 'vitest'
import { buildWelcomeData, shouldMountWelcome, GEO_CONCERT_CAP } from './welcomeProps'
import type { WelcomeConfig } from './welcome'
import type { Concert } from '@/types/concert'
import type { PostSummary } from '@/types/post'
import type { SlugMap } from './slugs'

const cfg = (over: Partial<WelcomeConfig> = {}, geo: Partial<WelcomeConfig['geo']> = {}): WelcomeConfig => ({
  blocks: ['concerts', 'news', 'newsletter', 'account'],
  concert_count: 2,
  frequency: 'interval',
  reshow_days: 90,
  campaign: 1,
  ...over,
  geo: { enabled: false, radius_km: 100, far_visitors: 'hide_gigs', ...geo },
})

const concert = (id: number, date: string): Concert =>
  ({ id, date, slug: `gig-${id}`, venue: { name: `Venue ${id}`, city: `City ${id}` } }) as unknown as Concert

const post = (id: number, slug: string, pl?: string): PostSummary =>
  ({
    id, title: `Post ${id}`, slug, image: null, published_at: '2026-11-01T10:00:00.000000Z',
    translations: { title: {}, intro: {}, slug: { en: slug, ...(pl ? { pl } : {}) } },
  }) as unknown as PostSummary

const slugMap: SlugMap = {
  en: { concerts: 'shows', posts: 'news' },
  pl: { concerts: 'koncerty', posts: 'aktualnosci' },
}

// "Today" is 1 Dec 2026 (local) in these tests.
const now = new Date(2026, 11, 1, 15, 0, 0)

const base = {
  lang: 'en' as const,
  modules: {},
  concerts: [concert(3, '2027-02-01'), concert(1, '2026-10-01'), concert(2, '2026-12-05'), concert(4, '2027-01-10')],
  latestPost: post(9, 'latest', 'najnowszy'),
  slugMap,
  now,
}

describe('buildWelcomeData', () => {
  it('keeps only upcoming shows, in date order, capped at concert_count', () => {
    const d = buildWelcomeData({ ...base, config: cfg() })
    expect(d.concerts.map(c => c.id)).toEqual([2, 4])
    expect(d.concerts[0]).toMatchObject({ city: 'City 2', venue: 'Venue 2', href: '/en/shows/gig-2', isoDate: '2026-12-05' })
  })

  it('keeps a show dated today and drops yesterday, at any hour', () => {
    const concerts = [concert(1, '2026-12-01'), concert(2, '2026-11-30')]
    const d = buildWelcomeData({ ...base, concerts, config: cfg(), now: new Date(2026, 11, 1, 23, 59) })
    expect(d.concerts.map(c => c.id)).toEqual([1])
  })

  it('passes every upcoming show (up to the cap) when geo targeting is on', () => {
    const d = buildWelcomeData({ ...base, config: cfg({}, { enabled: true }) })
    expect(d.concerts.map(c => c.id)).toEqual([2, 4, 3])
    const many = Array.from({ length: 70 }, (_, i) => concert(i + 10, '2027-03-01'))
    expect(buildWelcomeData({ ...base, concerts: many, config: cfg({}, { enabled: true }) }).concerts)
      .toHaveLength(GEO_CONCERT_CAP)
  })

  it('links the latest post through the locale section slug and postSlug()', () => {
    expect(buildWelcomeData({ ...base, config: cfg() }).post?.href).toBe('/en/news/latest')
    expect(buildWelcomeData({ ...base, lang: 'pl', config: cfg() }).post?.href).toBe('/pl/aktualnosci/najnowszy')
  })

  it('applies the module gates with !== false', () => {
    const off = buildWelcomeData({ ...base, modules: { concerts: false, posts: false, newsletter: false }, config: cfg() })
    expect(off.concerts).toEqual([])
    expect(off.post).toBeNull()
    expect(off.available).toEqual({ concerts: false, news: false, newsletter: false, account: true })
    const open = buildWelcomeData({ ...base, config: cfg() })
    expect(open.available).toEqual({ concerts: true, news: true, newsletter: true, account: true })
  })

  it('reports no gigs and no news when there is no data', () => {
    const d = buildWelcomeData({ ...base, concerts: [concert(1, '2026-01-01')], latestPost: null, config: cfg() })
    expect(d.available.concerts).toBe(false)
    expect(d.available.news).toBe(false)
  })
})

describe('shouldMountWelcome', () => {
  const data = buildWelcomeData({ ...base, config: cfg() })

  it('needs the module explicitly enabled and a config', () => {
    expect(shouldMountWelcome(true, cfg(), data)).toBe(true)
    expect(shouldMountWelcome(undefined, cfg(), data)).toBe(false)
    expect(shouldMountWelcome(false, cfg(), data)).toBe(false)
    expect(shouldMountWelcome(true, undefined, data)).toBe(false)
  })

  it('needs at least one enabled block with data', () => {
    const empty = buildWelcomeData({ ...base, concerts: [], latestPost: null, config: cfg() })
    expect(shouldMountWelcome(true, cfg({ blocks: ['concerts', 'news'] }), empty)).toBe(false)
    expect(shouldMountWelcome(true, cfg({ blocks: ['concerts', 'account'] }), empty)).toBe(true)
  })
})
