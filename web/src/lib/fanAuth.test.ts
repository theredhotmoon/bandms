import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommentApiError, readFanSession } from './comments'
import { CLAIM_KEY, fanAuthErrorText, newClaim, registerWithPassword, signInWithPassword } from './fanAuth'

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
