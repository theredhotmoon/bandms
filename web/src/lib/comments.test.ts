import { describe, expect, it } from 'vitest'
import {
  RETURN_KEY, cleanReturnPath, clearFanSession, formatCommentDate, readFanSession, rememberReturnPath, storeFan,
} from './comments'

describe('rememberReturnPath', () => {
  it('notes a site path for the account page to match', () => {
    const store = memoryStore()

    rememberReturnPath('/en/news/tour-dates#comments', store)

    expect(store.data.get(RETURN_KEY)).toBe('/en/news/tour-dates#comments')
  })

  it('notes nothing for a path that leaves the site', () => {
    const store = memoryStore()

    rememberReturnPath('//evil.example/x', store)

    expect(store.data.size).toBe(0)
  })

  it('uses the key the account page reads', () => {
    // app/src/utils/returnPath.ts holds the other half; the two must agree.
    expect(RETURN_KEY).toBe('fan_return_to')
  })
})

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

const FAN = { id: 7, email: 'a@b.c', name: 'a', display_name: 'Ania' }

describe('cleanReturnPath', () => {
  it.each(['/en/news/tour-dates#comments', '/pl/aktualnosci/nowa-plyta', '/'])('keeps %s', (path) => {
    expect(cleanReturnPath(path)).toBe(path)
  })

  it.each([
    ['protocol-relative', '//evil.example/x'],
    ['backslash host', '/\\evil.example'],
    ['absolute url', 'https://evil.example/'],
    ['no leading slash', 'en/news'],
    ['control character', '/en/news\n//evil.example'],
    ['too long', '/' + 'a'.repeat(300)],
    ['empty', ''],
    ['not a string', null],
  ])('drops %s', (_label, value) => {
    expect(cleanReturnPath(value)).toBeNull()
  })
})

describe('readFanSession', () => {
  it('reads the session the account page stored', () => {
    const store = memoryStore({ fan_token: 'tok', fan: JSON.stringify(FAN) })

    expect(readFanSession(store)).toEqual({ token: 'tok', fan: FAN })
  })

  it.each([
    ['no token', { fan: JSON.stringify(FAN) }],
    ['no profile', { fan_token: 'tok' }],
    ['broken JSON', { fan_token: 'tok', fan: '{oops' }],
    ['JSON null', { fan_token: 'tok', fan: 'null' }],
    ['profile without an id', { fan_token: 'tok', fan: JSON.stringify({ email: 'a@b.c' }) }],
  ])('is signed out with %s', (_label, initial) => {
    expect(readFanSession(memoryStore(initial as Record<string, string>))).toBeNull()
  })

  it('is signed out when storage is unavailable or throws', () => {
    const throwing = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }

    expect(readFanSession(null)).toBeNull()
    expect(readFanSession(throwing)).toBeNull()
    expect(() => storeFan(FAN, throwing)).not.toThrow()
    expect(() => clearFanSession(throwing)).not.toThrow()
  })
})

describe('storeFan / clearFanSession', () => {
  it('updates the profile and leaves the token', () => {
    const store = memoryStore({ fan_token: 'tok', fan: JSON.stringify(FAN) })

    storeFan({ ...FAN, display_name: 'Anna' }, store)

    expect(readFanSession(store)?.fan.display_name).toBe('Anna')
    expect(store.data.get('fan_token')).toBe('tok')
  })

  it('removes both keys', () => {
    const store = memoryStore({ fan_token: 'tok', fan: JSON.stringify(FAN) })

    clearFanSession(store)

    expect(store.data.size).toBe(0)
  })
})

describe('formatCommentDate', () => {
  it('formats in the page language', () => {
    expect(formatCommentDate('2026-11-12T10:00:00Z', 'en')).toContain('November')
    expect(formatCommentDate('2026-11-12T10:00:00Z', 'pl')).toContain('listopada')
  })

  it('returns nothing for a date it cannot read', () => {
    expect(formatCommentDate('not a date', 'en')).toBe('')
  })
})
