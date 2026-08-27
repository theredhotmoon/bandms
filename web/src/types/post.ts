import type { Tag } from './tag'

export type PostLinkType = 'youtube' | 'instagram' | 'facebook' | 'normal'

export interface PostLink {
  id: number
  type: PostLinkType
  url: string
  label: string | null
  sort_order: number
}

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
  translations?: {
    title: { en?: string | null; pl?: string | null }
    intro: { en?: string | null; pl?: string | null }
  }
}

export interface PostConcert      { id: number; slug_en: string; date: string; venue: { id: number; name: string } | null }
export interface PostRelease      { id: number; title: string; type: string }
export interface PostMusicVideo   { id: number; title: string; video_url: string }

export interface PostPressRelease {
  id: number
  /** Headline, falling back to the raw URL when no og:title was scraped. */
  title: string
  url: string
  /** Publication name, falling back to the URL host. */
  site: string | null
}

export interface Post extends PostSummary {
  content: string | null
  image: string | null
  links: PostLink[]
  concerts: PostConcert[]
  releases: PostRelease[]
  music_videos: PostMusicVideo[]
  /**
   * Coverage of this post. The design shows press only as context inside a
   * story, never as a standalone index — the first entry doubles as the
   * article's pull quote.
   *
   * Optional because the API only includes it when the relation is loaded.
   */
  press_releases?: PostPressRelease[]
  translations?: {
    title:   { en?: string | null; pl?: string | null }
    intro:   { en?: string | null; pl?: string | null }
    content: { en?: string | null; pl?: string | null }
  }
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}
