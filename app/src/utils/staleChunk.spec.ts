import { describe, expect, it } from 'vitest'
import { RELOAD_KEY, claimReload, isStaleChunkError } from './staleChunk'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
}

describe('isStaleChunkError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/PhotosAdminView-DD2It20X.js',
    'error loading dynamically imported module: https://x/assets/A.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/A.css',
  ])('recognises %s', (message) => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true)
  })

  it('ignores ordinary errors', () => {
    expect(isStaleChunkError(new Error('Request failed with status 500'))).toBe(false)
    expect(isStaleChunkError(undefined)).toBe(false)
  })
})

describe('claimReload', () => {
  it('allows the first reload and records it', () => {
    const s = memoryStorage()
    expect(claimReload(() => s, 1_000_000)).toBe(true)
    expect(s.data[RELOAD_KEY]).toBe('1000000')
  })

  it('refuses a second reload inside the cooldown, so a missing chunk cannot loop', () => {
    const s = memoryStorage({ [RELOAD_KEY]: '1000000' })
    expect(claimReload(() => s, 1_005_000)).toBe(false)
  })

  it('allows another reload once the cooldown has passed (the next deploy)', () => {
    const s = memoryStorage({ [RELOAD_KEY]: '1000000' })
    expect(claimReload(() => s, 1_011_000)).toBe(true)
  })

  it('refuses when storage throws rather than reloading unguarded', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
    }
    expect(claimReload(() => broken, 1)).toBe(false)
  })

  it('refuses when reaching the storage itself throws', () => {
    expect(
      claimReload(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      }, 1),
    ).toBe(false)
  })

  it('ignores a stored time in the future, so a clock set back cannot block reloads', () => {
    const s = memoryStorage({ [RELOAD_KEY]: '5000000' })
    expect(claimReload(() => s, 1_000_000)).toBe(true)
  })
})
