import { describe, it, expect } from 'vitest'
import { CLIP_CATEGORY_PRESETS, isPresetCategory, presetMessageKey } from './clipCategories'

describe('clipCategories', () => {
  it('lists the five presets in order', () => {
    expect(CLIP_CATEGORY_PRESETS).toEqual(['live', 'studio', 'backstage', 'interview', 'other'])
  })
  it('tells a preset from a custom category', () => {
    expect(isPresetCategory('studio')).toBe(true)
    expect(isPresetCategory('charity gig')).toBe(false)
  })
  it('returns the catalogue key for a preset', () => {
    expect(presetMessageKey('backstage')).toBe('common.clipCategory.backstage')
  })
  // null, not the raw value: the caller prints custom text as the band typed
  // it, and a non-existent key would render as the key.
  it('returns null for a custom category', () => {
    expect(presetMessageKey('charity gig')).toBeNull()
  })
})
