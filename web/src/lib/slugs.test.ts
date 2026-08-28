import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The slug map decides two different things: which routes `getStaticPaths`
 * generates, and which hrefs the Header and Footer emit. Those are computed by
 * separate callers in the same build, so the map has to be identical for all of
 * them — a disagreement means links pointing at pages that were never built, on
 * a build `astro build` reports as green.
 *
 * Both of the shipped bugs here were about that invariant, from opposite sides:
 * first a permanent cache of a fail-open config (module keys for the whole build,
 * even after the API recovered), then no cache at all (routes and links resolved
 * against different configs).
 */
const CONFIG = {
  en: {
    modules: { shop: true, videos: true },
    module_order: ['shop', 'videos'],
    module_config: { shop: { slug: 'shop' }, videos: { slug: '' } },
  },
  pl: {
    modules: { shop: true, videos: true },
    module_order: ['shop', 'videos'],
    module_config: { shop: { slug: 'sklep' }, videos: { slug: '' } },
  },
}

/** Fails the first `failures` calls per locale, then serves CONFIG. */
function stubFetch(failures: number) {
  const seen = new Map<string, number>()

  return vi.fn(async (url: string) => {
    const lang = new URL(url, 'http://test').searchParams.get('lang') ?? 'en'
    const n = (seen.get(lang) ?? 0) + 1
    seen.set(lang, n)

    if (n <= failures) return { ok: false, status: 503 } as Response

    return {
      ok: true,
      json: async () => CONFIG[lang as 'en' | 'pl'],
    } as unknown as Response
  })
}

async function freshModule() {
  vi.resetModules()
  return await import('./slugs')
}

beforeEach(() => {
  vi.stubGlobal('console', { ...console, warn: vi.fn() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getSlugMap', () => {
  it('serves the per-locale slugs the API stores', async () => {
    vi.stubGlobal('fetch', stubFetch(0))
    const { getSlugMap } = await freshModule()

    const map = await getSlugMap()

    expect(map.en.shop).toBe('shop')
    expect(map.pl.shop).toBe('sklep')
  })

  it('falls back to the module key when a module stores no slug', async () => {
    vi.stubGlobal('fetch', stubFetch(0))
    const { getSlugMap } = await freshModule()

    const map = await getSlugMap()

    expect(map.en.videos).toBe('videos')
    expect(map.pl.videos).toBe('videos')
  })

  it('retries past a blip instead of freezing module keys for the build', async () => {
    // Two failed attempts per locale, then success. Caching the first fail-open
    // result locked /pl/shop in for every page for the rest of the build.
    vi.stubGlobal('fetch', stubFetch(2))
    const { getSlugMap } = await freshModule()

    expect((await getSlugMap()).pl.shop).toBe('sklep')
  })

  it('resolves once, so two callers in one build cannot disagree', async () => {
    // The regression this pins: dropping the cache on a fail-open config fixed
    // the staleness above and broke consistency. The first caller resolved
    // during the blip and got module keys; the next, after the retry landed, got
    // real slugs. getStaticPaths built /pl/shop while every nav link said
    // /pl/sklep.
    vi.stubGlobal('fetch', stubFetch(2))
    const { getSlugMap } = await freshModule()

    const routes = await getSlugMap()
    const navLinks = await getSlugMap()

    expect(navLinks).toEqual(routes)
    expect(navLinks.pl.shop).toBe('sklep')
  })

  it('is consistent, not absent, when the API never answers', async () => {
    // Throwing here would be worse than wrong slugs: a failed Astro build
    // crash-loops the web container and takes the whole public site down.
    vi.stubGlobal('fetch', stubFetch(Infinity))
    const { getSlugMap } = await freshModule()

    const first = await getSlugMap()
    const second = await getSlugMap()

    expect(first).toEqual(second)
    // No module_config to read, so only the static fallbacks survive.
    expect(first.pl.contact).toBe('kontakt')
    expect(first.pl.shop).toBeUndefined()
  })
})
