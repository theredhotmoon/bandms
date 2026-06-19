import type { Tag } from './tag'

export interface AlbumPhoto {
  id: number
  image_url: string | null
  sort_order: number
  caption: string | null
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
  created_at: string
  updated_at: string
}
