import type { Tag } from './tag'

export interface AlbumPhoto {
  id: number
  image_url: string | null
  sort_order: number
  caption: string | null
  /**
   * Marked as press-ready in the admin. The public gallery badges these.
   * Optional because an API predating the flag omits it — read as `?? false`.
   */
  epk_featured?: boolean
}

export interface Album {
  id: number
  title: string
  slug: string
  description: string | null
  taken_at: string | null
  published_at: string | null
  tags: Tag[]
  photos: AlbumPhoto[]
  photo_count: number
  cover_url: string | null
  /**
   * Where the album was shot. `AlbumResource` has always sent these two; they
   * were simply missing from this interface, which is how the gallery went years
   * without a "shot at" line. Both are nullable — an album need not be tied to a
   * venue or a gig.
   */
  venue: { id: number; name: string } | null
  concert: { id: number; date: string; description: string | null } | null
  created_at: string
  updated_at: string
}
