import { describe, expect, it } from 'vitest'
import { cleanReturnPath, consumeReturnPath, RETURN_KEY } from './returnPath'

describe('cleanReturnPath', () => {
  it.each(['/en/news/tour-dates#comments', '/pl/aktualnosci/nowa-plyta', '/'])('keeps the site path %s', (path) => {
    expect(cleanReturnPath(path)).toBe(path)
  })

  it.each([
    ['protocol-relative', '//evil.example/x'],
    ['backslash host', '/\\evil.example'],
    ['absolute url', 'https://evil.example/'],
    ['no leading slash', 'en/news'],
    ['script scheme', 'javascript:alert(1)'],
    ['control character', '/en/news\n//evil.example'],
    ['too long', '/' + 'a'.repeat(300)],
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
    ['repeated query param', ['/en', '/pl']],
  ])('drops %s', (_label, value) => {
    expect(cleanReturnPath(value)).toBeNull()
  })
})

describe('consumeReturnPath', () => {
  const PATH = '/en/news/tour-dates#comments'

  function store(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial))
    return {
      getItem: (k: string) => data.get(k) ?? null,
      removeItem: (k: string) => void data.delete(k),
      data,
    }
  }

  it('follows the link when this browser asked for that path, once', () => {
    const s = store({ [RETURN_KEY]: PATH })

    expect(consumeReturnPath(PATH, s)).toBe(PATH)
    expect(s.data.has(RETURN_KEY)).toBe(false)
    expect(consumeReturnPath(PATH, s)).toBeNull()
  })

  it('stays put when this browser never asked — someone else sent the link', () => {
    expect(consumeReturnPath(PATH, store())).toBeNull()
  })

  it('stays put when the link names a different path than the one asked from', () => {
    const s = store({ [RETURN_KEY]: '/en/news/other#comments' })

    expect(consumeReturnPath(PATH, s)).toBeNull()
    // The note is spent either way: a later link cannot reuse it.
    expect(s.data.has(RETURN_KEY)).toBe(false)
  })

  it('never follows an off-site path, even if one was stored', () => {
    expect(consumeReturnPath('//evil.example/x', store({ [RETURN_KEY]: '//evil.example/x' }))).toBeNull()
  })

  it('stays put without storage, or when storage throws', () => {
    const throwing = {
      getItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }

    expect(consumeReturnPath(PATH, null)).toBeNull()
    expect(consumeReturnPath(PATH, throwing)).toBeNull()
  })
})
