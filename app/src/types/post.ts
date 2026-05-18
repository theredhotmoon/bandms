import type { Tag } from './tag'

export interface PostConcert      { id: number; date: string; venue: { id: number; name: string } | null }
export interface PostAlbum        { id: number; title: string }
export interface PostRelease      { id: number; title: string; type: string }
export interface PostTour         { id: number; name: string }
export interface PostMusicVideo   { id: number; title: string; video_url: string }
export interface PostPressRelease { id: number; title: string; url: string }

export type PostLinkType = 'youtube' | 'instagram' | 'facebook' | 'normal'

export interface PostLink {
  id: number
  type: PostLinkType
  url: string
  label: string | null
  sort_order: number
}

export interface PostLinkPayload {
  type: PostLinkType
  url: string
  label?: string | null
}

/** Returned in list responses — no image, content replaced by excerpt. */
export interface PostSummary {
  id: number
  title: string
  slug: string
  intro: string | null
  excerpt: string
  published_at: string | null
  event_date: string | null
  tags: Tag[]
  created_at: string
  updated_at: string
}

/** Returned in detail response — includes image, full content, links, and linked entities. */
export interface Post extends PostSummary {
  content: string | null
  image: string | null
  links: PostLink[]
  concerts: PostConcert[]
  albums: PostAlbum[]
  releases: PostRelease[]
  tours: PostTour[]
  music_videos: PostMusicVideo[]
  press_releases: PostPressRelease[]
}

export interface PostPayload {
  title: string
  intro?: string | null
  content?: string | null
  image?: string | null
  published_at?: string | null
  event_date?: string | null
  tag_ids?: number[]
  concert_ids?: number[]
  album_ids?: number[]
  release_ids?: number[]
  tour_ids?: number[]
  music_video_ids?: number[]
  press_release_ids?: number[]
  links?: PostLinkPayload[]
}
