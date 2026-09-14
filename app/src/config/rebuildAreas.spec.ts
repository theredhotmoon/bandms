import { describe, it, expect } from 'vitest'
import { rebuildAreaLabel } from './rebuildAreas'

describe('rebuildAreaLabel', () => {
  it('returns the mapped label for a known area', () => {
    expect(rebuildAreaLabel('concerts')).toBe('Concerts')
  })

  it('falls back to the raw key for an unmapped area', () => {
    expect(rebuildAreaLabel('some-new-area')).toBe('some-new-area')
  })
})
