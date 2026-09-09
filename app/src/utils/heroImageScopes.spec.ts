import { describe, it, expect } from 'vitest'
import { scopeSet, hasOwnSet } from './heroImageScopes'
import type { HeroImageSets } from '@/types/heroImage'

const SETS: HeroImageSets = {
  main: [{ id: 1, url: '/storage/a.jpg', caption: null, position: 0, active: true }],
  contact: [],
  about: [{ id: 2, url: '/storage/b.jpg', caption: null, position: 0, active: false }],
}

describe('scopeSet', () => {
  it("returns the scope's own list, including inactive rows", () => {
    expect(scopeSet(SETS, 'about')).toHaveLength(1)
  })

  it('returns an empty list for a scope with no entry', () => {
    expect(scopeSet(SETS, 'nowhere')).toEqual([])
  })

  it('returns an empty list when the sets are undefined', () => {
    // The query is still loading, or the request failed.
    expect(scopeSet(undefined, 'main')).toEqual([])
  })
})

describe('hasOwnSet', () => {
  it('is true only when the scope has at least one active picture', () => {
    expect(hasOwnSet(SETS, 'main')).toBe(true)
    // An empty stored set is "inherits main", matching the public resolver —
    // the two must agree or the admin lies about what the page will show.
    expect(hasOwnSet(SETS, 'contact')).toBe(false)
    expect(hasOwnSet(SETS, 'nowhere')).toBe(false)
  })

  it('treats a scope holding only inactive pictures as no override', () => {
    // resolveHeroImages() on the public side never learns an inactive picture
    // exists, so the admin summary has to agree: "inherits Main," not "1 picture."
    expect(hasOwnSet(SETS, 'about')).toBe(false)
  })

  it('treats a missing sets object as no override', () => {
    expect(hasOwnSet(undefined, 'contact')).toBe(false)
  })
})
