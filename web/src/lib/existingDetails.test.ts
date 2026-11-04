import { describe, expect, it, vi } from 'vitest'
import { existingDetails, inEveryLocale } from './existingDetails'

const opts = { label: (n: number) => `item ${n}` }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('existingDetails', () => {
  it('pairs each item with its detail, in listing order', async () => {
    // Later items answer first; the result still follows the list.
    const result = await existingDetails([1, 2, 3], async (n) => {
      await sleep(10 * (4 - n))
      return `detail ${n}`
    }, opts)

    expect(result).toEqual([
      { item: 1, detail: 'detail 1' },
      { item: 2, detail: 'detail 2' },
      { item: 3, detail: 'detail 3' },
    ])
  })

  it('drops an item whose record is gone, builds the rest, and says which', async () => {
    // Post 722 was deleted between the listing and its page: not built,
    // instead of failing every page on the site.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await existingDetails([721, 722, 723], async (id) => (id === 722 ? null : { id }), {
      label: (id) => `post ${id}`,
    })

    expect(result.map((r) => r.item)).toEqual([721, 723])
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('post 722')
    warn.mockRestore()
  })

  it('still fails on a real error, so a broken API does not publish an empty site', async () => {
    await expect(existingDetails([1, 2], async (n) => {
      if (n === 2) throw new Error('CMS 500: /posts/2')
      return n
    }, opts)).rejects.toThrow('CMS 500')
  })

  it('stops fetching once one fetch has failed', async () => {
    const fetched: number[] = []
    await expect(existingDetails(Array.from({ length: 50 }, (_, i) => i), async (n) => {
      fetched.push(n)
      await sleep(2)
      if (n === 0) throw new Error('CMS 500')
      return n
    }, { ...opts, limit: 4 })).rejects.toThrow('CMS 500')
    await sleep(50) // let any worker that would keep going do so

    // The four already in flight, at most one more round — not all fifty.
    expect(fetched.length).toBeLessThan(10)
  })

  it('never has more than `limit` requests in flight', async () => {
    let inFlight = 0
    let peak = 0
    await existingDetails(Array.from({ length: 20 }, (_, i) => i), async (n) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await sleep(5)
      inFlight--
      return n
    }, { ...opts, limit: 4 })

    expect(peak).toBe(4)
  })

  it('makes no request for an empty list', async () => {
    let calls = 0
    expect(await existingDetails([], async () => { calls++; return 1 }, opts)).toEqual([])
    expect(calls).toBe(0)
  })
})

describe('inEveryLocale', () => {
  it('keys each detail by its locale', async () => {
    expect(await inEveryLocale(['en', 'pl'] as const, async (l) => `post in ${l}`))
      .toEqual({ en: 'post in en', pl: 'post in pl' })
  })

  it('is null when the record is gone in any locale, so no page links a twin that was not built', async () => {
    // Deleted between the en and the pl request.
    expect(await inEveryLocale(['en', 'pl'] as const, async (l) => (l === 'pl' ? null : 'post'))).toBeNull()
  })
})
