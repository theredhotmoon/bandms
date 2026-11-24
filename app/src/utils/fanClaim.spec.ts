import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLAIM_KEY, consumeClaim, newClaim, restoreClaim, withNewClaim } from './fanClaim'

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('newClaim', () => {
  it('stores a 64-char hex claim and resolves to its SHA-256', async () => {
    const store = memoryStore()
    const hash = await newClaim(store)
    const claim = store.getItem(CLAIM_KEY)
    expect(claim).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(claim!))
    const expected = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    expect(hash).toBe(expected)
  })

  it('is null, storing nothing, when the store throws', async () => {
    const store = {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => { throw new Error('quota') },
    }
    expect(await newClaim(store)).toBeNull()
  })

  it('is null, storing nothing, without a store', async () => {
    expect(await newClaim(null)).toBeNull()
  })

  it('is null, storing nothing, without crypto.subtle', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const store = memoryStore()
    expect(await newClaim(store)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it('removes the claim again when hashing fails', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      subtle: { digest: () => Promise.reject(new Error('no')) },
    })
    const store = memoryStore()
    expect(await newClaim(store)).toBeNull()
    expect(store.data.size).toBe(0)
  })
})

describe('withNewClaim', () => {
  class Refused extends Error {}
  const refused = (err: unknown) => err instanceof Refused

  it('sends the hash of the new claim and keeps the claim', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
    let sent: string | null = null
    await withNewClaim(store, async (hash) => { sent = hash }, refused)
    expect(sent).toMatch(/^[0-9a-f]{64}$/)
    expect(store.getItem(CLAIM_KEY)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives the earlier mail its claim back when the server refuses the registration', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
    await expect(withNewClaim(store, () => Promise.reject(new Refused()), refused)).rejects.toBeInstanceOf(Refused)
    expect(store.getItem(CLAIM_KEY)).toBe('earlier')
  })

  it('leaves no claim behind a refusal when there was none before', async () => {
    const store = memoryStore()
    await expect(withNewClaim(store, () => Promise.reject(new Refused()), refused)).rejects.toBeInstanceOf(Refused)
    expect(store.getItem(CLAIM_KEY)).toBeNull()
  })

  it('keeps the new claim when no answer came: a mail may have gone out', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
    await expect(withNewClaim(store, () => Promise.reject(new TypeError('Failed to fetch')), refused)).rejects.toBeInstanceOf(TypeError)
    expect(store.getItem(CLAIM_KEY)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never undoes the claim of a registration made meanwhile in another tab', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
    await expect(withNewClaim(store, async () => {
      store.setItem(CLAIM_KEY, 'other-tab')
      throw new Refused()
    }, refused)).rejects.toBeInstanceOf(Refused)
    expect(store.getItem(CLAIM_KEY)).toBe('other-tab')
  })

  it('registers without a claim when there is no store, or it throws', async () => {
    const blocked = () => { throw new Error('blocked') }
    for (const store of [null, { getItem: blocked, setItem: blocked, removeItem: blocked }]) {
      let sent: string | null = 'unset'
      await withNewClaim(store, async (hash) => { sent = hash }, refused)
      expect(sent).toBeNull()
    }
  })

  it('keeps the earlier claim when a new one cannot be made', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      subtle: { digest: () => Promise.reject(new Error('no')) },
    })
    const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
    await withNewClaim(store, async () => {}, refused)
    expect(store.getItem(CLAIM_KEY)).toBe('earlier')
  })
})

describe('consumeClaim', () => {
  it('returns the claim once, then null', () => {
    const store = memoryStore({ [CLAIM_KEY]: 'abc' })
    expect(consumeClaim(store)).toBe('abc')
    expect(consumeClaim(store)).toBeNull()
  })

  it('is null without a store or when the store throws', () => {
    expect(consumeClaim(null)).toBeNull()
    expect(consumeClaim({
      getItem: () => { throw new Error('blocked') },
      removeItem: () => {},
    })).toBeNull()
  })
})

describe('restoreClaim', () => {
  it('puts a consumed claim back, so the link can be tried again', () => {
    const store = memoryStore({ [CLAIM_KEY]: 'abc' })
    const claim = consumeClaim(store)
    restoreClaim(store, claim)
    expect(consumeClaim(store)).toBe('abc')
  })

  it('never replaces a newer registration\'s claim', () => {
    const store = memoryStore({ [CLAIM_KEY]: 'newer' })
    restoreClaim(store, 'older')
    expect(store.getItem(CLAIM_KEY)).toBe('newer')
  })

  it('stores nothing when there was no claim', () => {
    const store = memoryStore()
    restoreClaim(store, null)
    expect(store.data.size).toBe(0)
  })

  it('is silent without a store or when the store throws', () => {
    restoreClaim(null, 'abc')
    restoreClaim({
      getItem: () => null,
      removeItem: () => {},
      setItem: () => { throw new Error('quota') },
    }, 'abc')
  })
})
