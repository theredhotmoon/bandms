/**
 * One hero backdrop picture, uploaded directly for hero use — not a gallery
 * photo. `id` is the hero_images row's own id.
 */
export interface HeroImage {
  id: number
  /** Null only if the stored file is somehow missing — render a placeholder, not a broken img. */
  url: string | null
  caption: string | null
  position: number
  active: boolean
}

/** Hero sets keyed by scope: 'main', 'home', or a website module slug. */
export type HeroImageSets = Record<string, HeroImage[]>

export interface HeroImagesResponse {
  data: HeroImageSets
}
