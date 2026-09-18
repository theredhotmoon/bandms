import { describe, it, expect } from 'vitest'
import { CLIP_CATEGORY_PRESETS, isPresetCategory, presetLabel } from './clipCategories'

describe('clipCategories', () => {
  it('lists the five presets in order', () => {
    expect(CLIP_CATEGORY_PRESETS).toEqual(['live', 'studio', 'backstage', 'interview', 'other'])
  })
  it('tells a preset from a custom category', () => {
    expect(isPresetCategory('studio')).toBe(true)
    expect(isPresetCategory('charity gig')).toBe(false)
  })
  it('labels presets for the admin and echoes custom text', () => {
    expect(presetLabel('backstage')).toBe('Backstage')
    expect(presetLabel('charity gig')).toBe('charity gig')
  })
})
