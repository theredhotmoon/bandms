import type { Tag } from './tag'

export interface PressReleaseMeta {
  og_title: string | null
  og_description: string | null
  og_image: string | null
  og_site_name: string | null
}

export interface PressReleaseConcert {
  id: number
  date: string
}

export interface PressReleasePost {
  id: number
  title: string
  slug: string
}

export interface PressReleaseAlbum {
  id: number
  title: string
}

export interface PressReleaseRelease {
  id: number
  title: string
  type: string
}

export interface PressReleaseTour {
  id: number
  name: string
}

export interface PressReleaseSummary {
  id: number
  profile_id: number
  url: string
  og_title: string | null
  og_description: string | null
  og_image: string | null
  og_site_name: string | null
  published_at: string | null
  featured: boolean
  tags: Tag[]
  concerts_count: number
  posts_count: number
  albums_count: number
  releases_count: number
  tours_count: number
  authors_count: number
  created_at: string
  updated_at: string
}

export interface PressRelease extends PressReleaseSummary {
  concerts: PressReleaseConcert[]
  posts: PressReleasePost[]
  albums: PressReleaseAlbum[]
  releases: PressReleaseRelease[]
  tours: PressReleaseTour[]
}

export interface PressReleasePayload {
  url: string
  og_title: string | null
  og_description: string | null
  og_image: string | null
  og_site_name: string | null
  published_at: string | null
  featured?: boolean
  concert_ids: number[]
  post_ids: number[]
  album_ids: number[]
  release_ids: number[]
  tour_ids: number[]
  tag_ids: number[]
}
