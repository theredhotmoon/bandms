import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPostBatch, MAX_BATCH, postBatchUrl } from './postFeed'

describe('postBatchUrl', () => {
  it('asks for one batch in the page language', () => {
    expect(postBatchUrl('', { lang: 'pl', limit: 9 })).toBe('/api/posts?lang=pl&limit=9')
  })

  it('carries the featured post, the cursor and both filters', () => {
    const url = new URL(postBatchUrl('http://backend/', {
      lang: 'en', limit: 6, exclude: 4, cursor: 'abc', tagId: 7, search: '  tour ', builtAt: '2026-10-30T10:00:00.000Z',
    }))
    expect(url.origin + url.pathname).toBe('http://backend/api/posts')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lang: 'en', limit: '6', exclude: '4', cursor: 'abc', tag_id: '7', search: 'tour', built_at: '2026-10-30T10:00:00.000Z',
    })
  })

  it('leaves out what is not set, and a blank search', () => {
    const url = postBatchUrl('', { lang: 'en', limit: 6, exclude: null, cursor: null, tagId: null, search: '   ' })
    expect(url).toBe('/api/posts?lang=en&limit=6')
  })

  // The API rejects anything past its cap with a 422, which would read as
  // "could not load" for a band that typed a big number.
  it('holds the limit to what the API accepts', () => {
    expect(postBatchUrl('', { lang: 'en', limit: 500 })).toContain(`limit=${MAX_BATCH}`)
    expect(postBatchUrl('', { lang: 'en', limit: 0 })).toContain('limit=1')
  })
})

describe('fetchPostBatch', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the posts and the next cursor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: 1 }], meta: { next_cursor: 'next' },
    }))))
    await expect(fetchPostBatch('', { lang: 'en', limit: 6 })).resolves.toEqual({ posts: [{ id: 1 }], nextCursor: 'next' })
  })

  it('reports the last batch as having no cursor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [], meta: { next_cursor: null } }))))
    await expect(fetchPostBatch('', { lang: 'en', limit: 6 })).resolves.toEqual({ posts: [], nextCursor: null })
  })

  it('throws on an error status rather than showing an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    await expect(fetchPostBatch('', { lang: 'en', limit: 6 })).rejects.toThrow('500')
  })
})
