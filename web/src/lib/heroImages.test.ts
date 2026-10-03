import { describe, it, expect } from 'vitest'
import { resolveHeroImages, heroWeights, pickWeightedIndex, type HeroImage } from './heroImages'
import type { SiteConfig } from './cms'

const img = (id: number): HeroImage => ({ id, url: `/storage/p${id}.jpg`, caption: null })

function config(hero_images?: Record<string, HeroImage[]>): SiteConfig {
  return { modules: {}, module_order: [], module_config: {}, hero_images } as SiteConfig
}

describe('resolveHeroImages', () => {
  it('returns the scope’s own set when it has one', () => {
    const cfg = config({ main: [img(1)], contact: [img(2)] })
    expect(resolveHeroImages(cfg, 'contact')).toEqual([img(2)])
  })

  it('falls back to main when the scope has no set', () => {
    const cfg = config({ main: [img(1)] })
    expect(resolveHeroImages(cfg, 'contact')).toEqual([img(1)])
  })

  it('falls back to main when the scope’s set is empty', () => {
    const cfg = config({ main: [img(1)], contact: [] })
    expect(resolveHeroImages(cfg, 'contact')).toEqual([img(1)])
  })

  it('returns an empty list when nothing is configured', () => {
    expect(resolveHeroImages(config({}), 'contact')).toEqual([])
  })

  it('returns an empty list when the API predates the feature', () => {
    // getSiteConfig fails open to {} when the API is unreachable mid-build, and
    // an older API omits the key entirely. Neither may throw.
    expect(resolveHeroImages(config(undefined), 'main')).toEqual([])
  })

  it('does not fall back for the main scope itself', () => {
    expect(resolveHeroImages(config({ main: [] }), 'main')).toEqual([])
  })
})

describe('heroWeights', () => {
  const img = (weight?: number | null): HeroImage => ({ id: 1, url: '/x.jpg', caption: null, weight })

  it('treats a missing or null weight as the maximum', () => {
    expect(heroWeights([img(), img(null)])).toEqual([100, 100])
  })

  it('keeps a weight between 1 and 100, and clamps anything outside', () => {
    expect(heroWeights([img(25), img(0), img(250), img(12.6)])).toEqual([25, 1, 100, 13])
  })
})

describe('pickWeightedIndex', () => {
  it('splits [0, 1) in proportion to the weights', () => {
    // 100 and 25: the first owns [0, 0.8), the second [0.8, 1).
    expect(pickWeightedIndex([100, 25], 0)).toBe(0)
    expect(pickWeightedIndex([100, 25], 0.79)).toBe(0)
    expect(pickWeightedIndex([100, 25], 0.8)).toBe(1)
    expect(pickWeightedIndex([100, 25], 0.999)).toBe(1)
  })

  it('makes a lower-weighted picture rarer, not impossible', () => {
    const counts = [0, 0]
    for (let k = 0; k < 1000; k++) counts[pickWeightedIndex([100, 25], k / 1000)]++
    expect(counts).toEqual([800, 200])
  })

  it('is uniform when nothing is weighted', () => {
    const counts = [0, 0, 0, 0]
    for (let k = 0; k < 400; k++) counts[pickWeightedIndex([100, 100, 100, 100], k / 400)]++
    expect(counts).toEqual([100, 100, 100, 100])
  })

  it('survives being shipped as source into an inline script', () => {
    // HeroBackdrop embeds String(pickWeightedIndex); it must stand alone.
    const revived = new Function(`return (${String(pickWeightedIndex)})`)() as typeof pickWeightedIndex
    expect(revived([100, 25], 0.9)).toBe(1)
  })
})
