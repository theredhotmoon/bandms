import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommentApiError, readFanSession } from './comments'
import {
  CLAIM_KEY, KEPT_CLAIM_KEY, fanAuthErrorText, fetchProviders, isPlainLeftClick, newClaim, newProviderClaim,
  providerName, providerUrl,
  registerWithPassword, signInWithPassword,
} from './fanAuth'

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('newClaim', () => {
  it('keeps the claim and returns its sha-256', async () => {
    const store = memoryStore()

    const hash = await newClaim(store)

    expect(store.getItem(CLAIM_KEY)).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).toBe(await sha256Hex(store.getItem(CLAIM_KEY)!))
  })

  it('uses the key the admin SPA reads', () => {
    expect(CLAIM_KEY).toBe('fan_claim')
  })

  it('returns null and stores nothing when storage is unavailable', async () => {
    expect(await newClaim(null)).toBeNull()

    const store = memoryStore()
    store.setItem = () => {
      throw new Error('quota')
    }
    expect(await newClaim(store)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it('returns null and stores nothing when crypto.subtle is missing', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const store = memoryStore()

    expect(await newClaim(store)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it('returns null and stores nothing when random bytes are unavailable', async () => {
    vi.stubGlobal('crypto', {
      subtle: crypto.subtle,
      getRandomValues: () => {
        throw new Error('no entropy')
      },
    })
    const store = memoryStore()

    expect(await newClaim(store)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it('removes the stored claim again when hashing fails', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      subtle: { digest: () => Promise.reject(new Error('boom')) },
    })
    const store = memoryStore()

    expect(await newClaim(store)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it('keeps the earlier claim when a new one cannot be made', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      subtle: { digest: () => Promise.reject(new Error('boom')) },
    })
    const store = memoryStore({ [CLAIM_KEY]: 'earlier' })

    expect(await newClaim(store)).toBeNull()
    expect(store.getItem(CLAIM_KEY)).toBe('earlier')
  })
})

describe('newProviderClaim', () => {
  const kept = (store: ReturnType<typeof memoryStore>) => JSON.parse(store.getItem(KEPT_CLAIM_KEY) ?? 'null')

  it('keeps the claim it replaces beside its own, under the key the admin SPA reads', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'registration' })

    const hash = await newProviderClaim(store)

    const own = store.getItem(CLAIM_KEY)!
    expect(hash).toBe(await sha256Hex(own))
    expect(KEPT_CLAIM_KEY).toBe('fan_claim_kept')
    expect(kept(store)).toEqual({ own, earlier: 'registration' })
  })

  it('keeps the registration\'s claim through a second press, not the first press\'s own', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'registration' })
    await newProviderClaim(store)
    await newProviderClaim(store)
    expect(kept(store)).toEqual({ own: store.getItem(CLAIM_KEY), earlier: 'registration' })
  })

  it('keeps nothing through a second press when there was nothing before the first', async () => {
    const store = memoryStore()
    await newProviderClaim(store)
    await newProviderClaim(store)
    expect(kept(store)).toEqual({ own: store.getItem(CLAIM_KEY), earlier: null })
  })

  it('keeps the newer registration when one came between two presses', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'first' })
    await newProviderClaim(store)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' })))
    await registerWithPassword('a@b.c', 'secret-pass', 'en', '/', store)
    const second = store.getItem(CLAIM_KEY)
    await newProviderClaim(store)
    expect(kept(store).earlier).toBe(second)
  })

  it('reads an entry it does not understand as none', async () => {
    for (const entry of ['{', '"x"', '{"own":1}']) {
      const store = memoryStore({ [CLAIM_KEY]: 'registration', [KEPT_CLAIM_KEY]: entry })
      await newProviderClaim(store)
      expect(kept(store).earlier).toBe('registration')
    }
  })

  it('changes nothing when no claim can be made', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      subtle: { digest: () => Promise.reject(new Error('boom')) },
    })
    const store = memoryStore({ [CLAIM_KEY]: 'registration' })

    expect(await newProviderClaim(store)).toBeNull()
    expect([...store.data]).toEqual([[CLAIM_KEY, 'registration']])
    expect(await newProviderClaim(null)).toBeNull()
  })
})

describe('registerWithPassword', () => {
  it('sends claim_hash and a cleaned return_to, never the claim', async () => {
    const store = memoryStore()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await registerWithPassword('a@b.c', 'secret-pass', 'en', '/en/news/x', store)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/fan/auth/register')
    const body = JSON.parse(init.body)
    const claim = store.getItem(CLAIM_KEY)!
    expect(body).toEqual({
      email: 'a@b.c',
      password: 'secret-pass',
      claim_hash: await sha256Hex(claim),
      return_to: '/en/news/x',
    })
    expect(init.body).not.toContain(claim)
  })

  it('sends null return_to for a path that leaves the site', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await registerWithPassword('a@b.c', 'secret-pass', 'en', '//evil.example', memoryStore())

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).return_to).toBeNull()
  })

  it('omits claim_hash when there is no claim', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await registerWithPassword('a@b.c', 'secret-pass', 'en', '/en/news/x', null)

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('claim_hash')
  })

  it('gives the earlier mail its claim back when the server refuses the registration', async () => {
    for (const status of [422, 429, 500, 503]) {
      const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { message: 'no' })))

      await expect(registerWithPassword('a@b.c', 'secret-pass', 'en', '/', store)).rejects.toMatchObject({ status })

      expect(store.getItem(CLAIM_KEY)).toBe('earlier')
    }
  })

  it('keeps the new claim when a gateway gave up: the API may have sent the mail', async () => {
    for (const status of [502, 504]) {
      const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
      const fetchMock = vi.fn().mockResolvedValue(new Response('<html>Gateway</html>', { status }))
      vi.stubGlobal('fetch', fetchMock)

      await expect(registerWithPassword('a@b.c', 'secret-pass', 'en', '/', store)).rejects.toMatchObject({ status })

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).claim_hash).toBe(await sha256Hex(store.getItem(CLAIM_KEY)!))
    }
  })

  it('leaves no claim behind a refusal when there was none before', async () => {
    const store = memoryStore()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(422, { message: 'no' })))

    await expect(registerWithPassword('a@b.c', 'x', 'en', '/', store)).rejects.toMatchObject({ status: 422 })

    expect(store.getItem(CLAIM_KEY)).toBeNull()
  })

  it('keeps the new claim when no answer came: a mail may have gone out', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(registerWithPassword('a@b.c', 'secret-pass', 'en', '/', store)).rejects.toBeInstanceOf(TypeError)

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).claim_hash).toBe(await sha256Hex(store.getItem(CLAIM_KEY)!))
  })

  it('never undoes the claim of a registration made meanwhile in another tab', async () => {
    const store = memoryStore({ [CLAIM_KEY]: 'earlier' })
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      store.setItem(CLAIM_KEY, 'other-tab')
      return jsonResponse(422, { message: 'no' })
    }))

    await expect(registerWithPassword('a@b.c', 'secret-pass', 'en', '/', store)).rejects.toMatchObject({ status: 422 })

    expect(store.getItem(CLAIM_KEY)).toBe('other-tab')
  })

  it('surfaces validation errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(422, { message: 'bad', errors: { password: ['Too short'] } })))

    await expect(registerWithPassword('a@b.c', 'x', 'en', '/', null)).rejects.toMatchObject({
      status: 422,
      message: 'Too short',
    })
  })
})

describe('signInWithPassword', () => {
  const FAN = { id: 7, email: 'a@b.c', name: 'a' }

  it('stores the session', async () => {
    const store = memoryStore()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { token: 'tok', fan: FAN }))
    vi.stubGlobal('fetch', fetchMock)

    const session = await signInWithPassword('a@b.c', 'secret-pass', 'pl', store)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/fan/auth/login')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@b.c', password: 'secret-pass' })
    expect(fetchMock.mock.calls[0][1].headers['Accept-Language']).toBe('pl')
    expect(session).toEqual({ token: 'tok', fan: FAN })
    expect(readFanSession(store)).toEqual({ token: 'tok', fan: FAN })
  })

  it('surfaces the server code on a failed sign-in and stores nothing', async () => {
    const store = memoryStore()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(422, { message: 'Wrong', code: 'login_failed' })))

    const error = await signInWithPassword('a@b.c', 'nope', 'en', store).catch((e) => e)

    expect(error).toBeInstanceOf(CommentApiError)
    expect(error.code).toBe('login_failed')
    expect(store.data.size).toBe(0)
  })

  it('surfaces the rate-limit code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, { message: 'Slow', code: 'login_limit' })))

    await expect(signInWithPassword('a@b.c', 'x', 'en', memoryStore())).rejects.toMatchObject({ code: 'login_limit' })
  })
})

describe('fanAuthErrorText', () => {
  const copy = { loginFailed: 'FAILED', loginLimit: 'LIMIT', failed: 'GENERIC' }

  it('words a wrong password and a rate limit from the copy, whatever the message', () => {
    expect(fanAuthErrorText(new CommentApiError(422, 'These credentials do not match', {}, 'login_failed'), copy)).toBe('FAILED')
    expect(fanAuthErrorText(new CommentApiError(429, 'Too Many Attempts.', {}, 'login_limit'), copy)).toBe('LIMIT')
  })

  it('shows a validation message the API worded for the fan', () => {
    expect(fanAuthErrorText(new CommentApiError(422, 'The password must be at least 8 characters.'), copy))
      .toBe('The password must be at least 8 characters.')
  })

  it('never shows a framework string: throttle, server error, network', () => {
    expect(fanAuthErrorText(new CommentApiError(429, 'Too Many Attempts.'), copy)).toBe('GENERIC')
    expect(fanAuthErrorText(new CommentApiError(500, 'Server Error'), copy)).toBe('GENERIC')
    expect(fanAuthErrorText(new TypeError('Failed to fetch'), copy)).toBe('GENERIC')
    expect(fanAuthErrorText(new CommentApiError(422, ''), copy)).toBe('GENERIC')
  })
})

describe('fetchProviders', () => {
  it('lists the configured providers it knows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { providers: ['google', 'myspace', 'facebook', 7] })))
    expect(await fetchProviders('en')).toEqual(['google', 'facebook'])
  })

  it('is empty on a 500', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, { message: 'Server Error' })))
    expect(await fetchProviders('en')).toEqual([])
  })

  it('is empty on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    expect(await fetchProviders('en')).toEqual([])
  })

  it('is empty when the body is not the expected shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { providers: 'google' })))
    expect(await fetchProviders('en')).toEqual([])
  })
})

describe('providerUrl', () => {
  it('encodes the return path and the language', () => {
    expect(providerUrl('google', 'pl', '/pl/news/a b?x=1&y=2', null))
      .toBe('/api/fan/auth/google/redirect?lang=pl&return_to=%2Fpl%2Fnews%2Fa%20b%3Fx%3D1%26y%3D2')
  })

  it('carries the claim hash only when there is one', () => {
    expect(providerUrl('facebook', 'en', '/en/news/a', 'abc123'))
      .toBe('/api/fan/auth/facebook/redirect?lang=en&return_to=%2Fen%2Fnews%2Fa&claim_hash=abc123')
    expect(providerUrl('facebook', 'en', '/en/news/a', null)).not.toContain('claim_hash')
  })

  it('drops a return path that is not a path on this site', () => {
    expect(providerUrl('google', 'en', '//evil.example', null)).not.toContain('return_to')
  })
})

describe('providerName and isPlainLeftClick', () => {
  it('names the providers properly', () => {
    expect(providerName('google')).toBe('Google')
    expect(providerName('facebook')).toBe('Facebook')
    expect(providerName('myspace')).toBe('')
    expect(providerName('constructor')).toBe('')
  })

  it('leaves modified clicks to the browser', () => {
    expect(isPlainLeftClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(true)
    expect(isPlainLeftClick({ button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false)
    expect(isPlainLeftClick({ button: 0, metaKey: false, ctrlKey: true, shiftKey: false, altKey: false })).toBe(false)
    expect(isPlainLeftClick({ button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false)
  })
})
