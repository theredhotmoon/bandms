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
      slug: `post-${start + i + 1}`,
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
 * locale — so the item fetch must say which one, like findRelease does.
 */
/**
 * The member detail route lists members in getStaticPaths and each page then
 * finds its member in getMembers(lang). Unmemoised, those were separate
 * requests, so a member deleted mid-build — an E2E spec's teardown racing its
 * own rebuild — was listed, then missing: `find()` returned undefined, the page
 * threw on `first_name`, and the all-or-nothing build took the site down.
 */
describe('getMembers', () => {
  it('answers each locale from one request, even after the API drops a member', async () => {
    let roster = [{ id: 1, slug: 'ana' }, { id: 2, slug: 'temp-member' }]
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => ({ data: roster }) }
    }))
    const { getMembers } = await freshModule()

    const listed = await getMembers('en')
    roster = [{ id: 1, slug: 'ana' }] // deleted between the path list and the page

    expect((await getMembers('en')).map(m => m.id)).toEqual([1, 2])
    expect(await getMembers('en')).toBe(listed)
    await getMembers('pl')
    expect(calls).toHaveLength(2)
  })
})

describe('findShopItem', () => {
  it('requests the locale it was given', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => ({ data: { id: 1 } }) }
    }))
    const { findShopItem } = await freshModule()

    await findShopItem('clip-tee', 'pl')

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/shop/by-slug/clip-tee')
    expect(calls[0]).toContain('lang=pl')
  })
})

/**
 * The detail route's records. A parallel delete between getStaticPaths
 * listing a post and its page fetching it 404'd ("CMS 404: /posts/722"), and
 * the all-or-nothing build took every page down with it. Gone is now null.
 */
describe('find* detail fetchers', () => {
  function stubStatus(status: number) {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return { ok: status < 400, status, json: async () => ({ data: { id: 7 } }) }
    }))
    return calls
  }

  it('returns the record, unwrapped, with the locale in the query', async () => {
    const calls = stubStatus(200)
    const { findConcert, findPost, findRelease } = await freshModule()

    expect(await findConcert(7, 'pl')).toEqual({ id: 7 })
    expect(await findPost(7, 'pl')).toEqual({ id: 7 })
    expect(await findRelease(7, 'pl')).toEqual({ id: 7 })
    expect(calls.map((u) => new URL(u, 'http://x').pathname)).toEqual(['/api/concerts/7', '/api/posts/7', '/api/releases/7'])
    expect(calls.every((u) => u.endsWith('?lang=pl'))).toBe(true)
  })

  it('is null for a record that is gone', async () => {
    stubStatus(404)
    const { findConcert, findPost, findRelease, findShopItem } = await freshModule()

    expect(await findConcert(7)).toBeNull()
    expect(await findPost(7)).toBeNull()
    expect(await findRelease(7)).toBeNull()
    expect(await findShopItem('tee')).toBeNull()
  })

  it('still throws on anything but a 404, so a broken API fails loudly', async () => {
    stubStatus(500)
    const { findPost } = await freshModule()

    await expect(findPost(7)).rejects.toThrow('CMS 500: /posts/7')
  })
})

/**
 * The concert list carries each concert's name resolved server-side. It was
 * fetched with no locale, so /pl/ pages printed English names beside Polish
 * labels — a green build, a wrong page.
 */
describe('getConcerts', () => {
  it('requests the locale it was given', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    }))
    const { getConcerts } = await freshModule()

    await getConcerts('pl')

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/concerts')
    expect(calls[0]).toContain('lang=pl')
  })

  // Every concert page derives prev/next and "more shows" from this list, so
  // one build must read one answer: a concert seeded mid-build used to show up
  // on some pages and not others, linked from pages though never built itself.
  it('answers each locale from one request for the whole build', async () => {
    let list = [{ id: 1 }]
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => ({ data: list }) }
    }))
    const { getConcerts } = await freshModule()

    const first = await getConcerts('en')
    list = [{ id: 1 }, { id: 2 }] // created by a parallel save mid-build

    expect(await getConcerts('en')).toBe(first)
    await getConcerts('pl')
    expect(calls).toHaveLength(2)
  })
})
