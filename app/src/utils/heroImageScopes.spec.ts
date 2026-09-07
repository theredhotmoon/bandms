import { describe, it, expect } from 'vitest'
import { scopeSet, hasOwnSet, shouldReseedDraft } from './heroImageScopes'
import type { HeroImageSets } from '@/types/heroImage'

const SETS: HeroImageSets = {
  main: [{ id: 1, photo_id: 10, url: '/storage/a.jpg', caption: null, position: 0 }],
  contact: [],
}

describe('scopeSet', () => {
  it('returns the scope’s own list', () => {
    expect(scopeSet(SETS, 'main')).toHaveLength(1)
  })

  it('returns an empty list for a scope with no entry', () => {
    expect(scopeSet(SETS, 'about')).toEqual([])
  })

  it('returns an empty list when the sets are undefined', () => {
    // The query is still loading, or the request failed.
    expect(scopeSet(undefined, 'main')).toEqual([])
  })
})

describe('hasOwnSet', () => {
  it('is true only when the scope has at least one picture', () => {
    expect(hasOwnSet(SETS, 'main')).toBe(true)
    // An empty stored set is "inherits main", matching the public resolver —
    // the two must agree or the admin lies about what the page will show.
    expect(hasOwnSet(SETS, 'contact')).toBe(false)
    expect(hasOwnSet(SETS, 'about')).toBe(false)
  })

  it('treats a missing sets object as no override', () => {
    expect(hasOwnSet(undefined, 'contact')).toBe(false)
  })
})

describe('shouldReseedDraft', () => {
  it('re-seeds when the scope changes, even with unsaved edits', () => {
    expect(shouldReseedDraft(true, true)).toBe(true)
  })

  it('re-seeds a clean draft when fresh data lands', () => {
    expect(shouldReseedDraft(false, false)).toBe(true)
  })

  it('leaves unsaved edits alone on a background refetch', () => {
    // The bug this pins: TanStack refetches on window focus, so alt-tabbing to
    // find another picture and coming back used to wipe every selection.
    expect(shouldReseedDraft(false, true)).toBe(false)
  })
})
