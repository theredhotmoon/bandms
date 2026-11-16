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
  /** Public records linking to this album. Absent from an older API. */
  linked?: AlbumLink[]
  created_at: string
  updated_at: string
}

/** An album as a card on a post, show, release or merch page — AlbumCardResource. */
export interface AlbumCard {
  id: number
  title: string
  /** The default locale's slug: the album page's URL in every language. */
  slug: string
  taken_at: string | null
  photo_count: number
  cover_url: string | null
}

/** A public record that links to an album — the album page's "See also". */
export type AlbumLink =
  | { type: 'post'; id: number; title: string; slug: string; translations: { slug: Record<string, string | null> } }
  | { type: 'concert'; id: number; title: string | null; slug: string; date: string | null; venue: string | null }
  | { type: 'release'; id: number; title: string; slug: null }
  | { type: 'shop_item'; id: number; title: string; slug: string }
