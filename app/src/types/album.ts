import type { Tag } from './tag'

export interface AlbumVenue {
  id: number
  name: string
}

export interface AlbumConcert {
  id: number
  date: string
  description: string | null
}

export interface AlbumPhoto {
  id: number
  image_url: string | null
  sort_order: number
  caption: string | null
  epk_featured: boolean
}

export interface Album {
  id: number
  title: string
  slug_en: string
  slug_pl: string | null
  description: string | null
  taken_at: string | null
  published_at: string | null
  venue: AlbumVenue | null
  concert: AlbumConcert | null
  tags: Tag[]
  photos: AlbumPhoto[]
  photo_count: number
  cover_url: string | null
  created_at: string
  updated_at: string
}

export interface AlbumPayload {
  title: string
  slug_en?: string | null
  slug_pl?: string | null
  description?: string | null
  venue_id?: number | null
  concert_id?: number | null
  taken_at?: string | null
  published_at?: string | null
  tag_ids?: number[]
}

export interface BatchAlbumUploadMeta {
  title: string
  slug_en?: string | null
  slug_pl?: string | null
  description?: string | null
  venue_id?: number | null
  concert_id?: number | null
  taken_at?: string | null
  published_at?: string | null
  tag_ids?: number[]
}
