/**
 * One hero backdrop entry, joined to its gallery photo.
 *
 * Note `id` is the hero_images row, not the photo — the public site's payload
 * (web/src/lib/heroImages.ts) names its photo id `id` instead, because it never
 * needs the join row. Save with `photo_id`, never `id`.
 */
export interface HeroImage {
  id: number
  photo_id: number
  /** Null when the underlying photo has no file — render a placeholder, not a broken img. */
  url: string | null
  caption: string | null
  position: number
}

/** Hero sets keyed by scope: 'main', 'home', or a website module slug. */
export type HeroImageSets = Record<string, HeroImage[]>

export interface HeroImagesResponse {
  data: HeroImageSets
}
