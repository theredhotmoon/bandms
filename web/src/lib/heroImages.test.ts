import { describe, it, expect } from 'vitest'
import { resolveHeroImages, type HeroImage } from './heroImages'
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
