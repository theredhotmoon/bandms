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
