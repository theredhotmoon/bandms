import { describe, it, expect } from 'vitest'
import { rebuildAreaMessageKey } from './rebuildAreas'

describe('rebuildAreaMessageKey', () => {
  it('returns the catalogue key for a known area', () => {
    expect(rebuildAreaMessageKey('concerts')).toBe('common.rebuildAreas.concerts')
  })

  it('handles a hyphenated area key', () => {
    expect(rebuildAreaMessageKey('music-videos')).toBe('common.rebuildAreas.music-videos')
  })

  // null, not the raw key: the caller decides how an unmapped area degrades,
  // and returning a key that does not exist would render the key itself.
  it('returns null for an unmapped area', () => {
    expect(rebuildAreaMessageKey('some-new-area')).toBeNull()
  })
})
