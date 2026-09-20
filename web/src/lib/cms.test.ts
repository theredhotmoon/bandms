import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * getAllPosts exists because the API paginates posts to 12 and getPosts serves
 * one page. The detail route's getStaticPaths fetched only page 1 while the
 * listing walked every page, so post 13 onwards was linked everywhere and
 * built nowhere — a 404 on a green build.
 */
async function freshModule() {
  vi.resetModules()
  return await import('./cms')
}

function stubPagedFetch(total: number, perPage = 12) {
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const calls: string[] = []

  const fetch = vi.fn(async (url: string) => {
    calls.push(url)
    const page = Number(new URL(url, 'http://x').searchParams.get('page') ?? '1')
    const start = (page - 1) * perPage
    const data = Array.from({ length: Math.max(0, Math.min(perPage, total - start)) }, (_, i) => ({
      id: start + i + 1,
      slug_en: `post-${start + i + 1}`,
      slug_pl: null,
    }))
    return {
      ok: true,
      status: 200,
      json: async () => ({ data, meta: { current_page: page, last_page: lastPage, per_page: perPage, total } }),
    }
  })

  return { fetch, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getAllPosts', () => {
  it('returns every post across all pages, in order', async () => {
    const { fetch } = stubPagedFetch(30)
    vi.stubGlobal('fetch', fetch)
    const { getAllPosts } = await freshModule()

    const posts = await getAllPosts('en')

    // 30, not the 12 a single page would yield — this is the regression.
    expect(posts).toHaveLength(30)
    expect(posts[0].id).toBe(1)
    expect(posts[12].id).toBe(13)
    expect(posts.at(-1)!.id).toBe(30)
  })

  it('makes one request per page and does not refetch page 1', async () => {
    const { fetch, calls } = stubPagedFetch(30)
    vi.stubGlobal('fetch', fetch)
    const { getAllPosts } = await freshModule()

    await getAllPosts('en')

    expect(fetch).toHaveBeenCalledTimes(3)
    const pages = calls.map(u => new URL(u, 'http://x').searchParams.get('page'))
    expect(pages).toEqual(['1', '2', '3'])
  })

  it('does not make a second request when there is only one page', async () => {
    const { fetch } = stubPagedFetch(5)
    vi.stubGlobal('fetch', fetch)
    const { getAllPosts } = await freshModule()

    const posts = await getAllPosts('en')

    expect(posts).toHaveLength(5)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('handles an empty archive', async () => {
    const { fetch } = stubPagedFetch(0)
    vi.stubGlobal('fetch', fetch)
    const { getAllPosts } = await freshModule()

    expect(await getAllPosts('en')).toEqual([])
  })

  it('requests the locale it was given', async () => {
    const { fetch, calls } = stubPagedFetch(5)
    vi.stubGlobal('fetch', fetch)
    const { getAllPosts } = await freshModule()

    await getAllPosts('pl')

    expect(calls.every(u => u.includes('lang=pl'))).toBe(true)
  })
})

/**
 * getBandProfile is read by BaseLayout on every page (for the <title> suffix)
 * as well as by the Footer and most pages themselves. Unmemoised that was three
 * requests per page across the build, and a single transient failure — caught
 * by the layout's fail-open — silently baked one page with no band name.
 */
describe('getBandProfile', () => {
  function stubProfileFetch(failFirst = 0) {
    const calls: string[] = []
    let n = 0
    const fetch = vi.fn(async (url: string) => {
      calls.push(url)
      n += 1
      if (n <= failFirst) return { ok: false, status: 503, json: async () => ({}) }
      const lang = new URL(url, 'http://x').searchParams.get('lang')
      return { ok: true, status: 200, json: async () => ({ data: { name: `Band (${lang})` } }) }
    })
    return { fetch, calls }
  }

  it('fetches each locale once, however many pages ask', async () => {
    const { fetch, calls } = stubProfileFetch()
    vi.stubGlobal('fetch', fetch)
    const { getBandProfile } = await freshModule()

    const [a, b, c, d] = await Promise.all([
      getBandProfile('en'), getBandProfile('en'), getBandProfile('pl'), getBandProfile(),
    ])

    expect(calls).toHaveLength(2)
    expect(a.name).toBe('Band (en)')
    expect(a).toBe(b)
    expect(c.name).toBe('Band (pl)')
    expect(d).toBe(a) // the default locale is 'en', and shares its entry
  })

  it('retries a blip on the next call rather than caching the failure', async () => {
    const { fetch, calls } = stubProfileFetch(1)
    vi.stubGlobal('fetch', fetch)
    const { getBandProfile } = await freshModule()

    await expect(getBandProfile('en')).rejects.toThrow('CMS 503')
    expect((await getBandProfile('en')).name).toBe('Band (en)')
    expect(calls).toHaveLength(2)
  })

  it('stops retrying after three failures and caches the rejection', async () => {
    const { fetch, calls } = stubProfileFetch(99)
    vi.stubGlobal('fetch', fetch)
    const { getBandProfile } = await freshModule()

    for (let i = 0; i < 5; i++) {
      await expect(getBandProfile('en')).rejects.toThrow('CMS 503')
    }

    // Three real attempts; the last two calls were answered from the cache.
    expect(calls).toHaveLength(3)
  })

  it('still rejects for callers that do not catch — a profile page must not build hollow', async () => {
    const { fetch } = stubProfileFetch(99)
    vi.stubGlobal('fetch', fetch)
    const { getBandProfile } = await freshModule()

    // What BaseLayout does, and what a page whose subject is the profile does.
    expect(await getBandProfile('en').catch(() => null)).toBeNull()
    await expect(getBandProfile('en')).rejects.toThrow()
  })
})

/**
 * A merch item carries clips whose titles the API resolves for the requested
 * locale — so the item fetch must say which one, like getRelease does.
 */
describe('getShopItem', () => {
  it('requests the locale it was given', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => ({ data: { id: 1 } }) }
    }))
    const { getShopItem } = await freshModule()

    await getShopItem('clip-tee', 'pl')

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/shop/by-slug/clip-tee')
    expect(calls[0]).toContain('lang=pl')
  })
})
