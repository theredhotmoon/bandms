import type { TranslationMap } from './shared'

export type ReleaseType     = 'LP' | 'EP' | 'single' | 'compilation'
export type ReleasePlatform = 'spotify' | 'apple_music' | 'bandcamp' | 'youtube' | 'instagram'

export interface ReleaseLink {
  id: number
  platform: ReleasePlatform
  url: string
}

export interface ReleaseTrackLink {
  id: number
  platform: ReleasePlatform
  url: string
}

export interface ReleaseTrack {
  id: number
  title: string
  duration: string | null
  lyrics: string | null
  sort_order: number
  bpm: number | null
  musical_key: string | null
  mood_tags: string | null
  isrc: string | null
  explicit: boolean
  stems_available: boolean
  sync_placements: string | null
  links: ReleaseTrackLink[]
}

export interface ReleasePhoto {
  id: number
  image_url: string | null
  sort_order: number
  caption: string | null
}

export interface ReleaseSummary {
  id: number
  profile_id: number
  title: string
  slug_en: string | null
  slug_pl: string | null
  type: ReleaseType
  release_date: string | null
  cover_image: string | null
  is_upcoming: boolean
  presave_url: string | null
  label_name: string | null
  links: ReleaseLink[]
  created_at: string
  updated_at: string
  translations?: {
    title:       { en?: string | null; pl?: string | null }
    description?: { en?: string | null; pl?: string | null }
  }
}

export interface Release extends ReleaseSummary {
  description: string | null
  tracks: ReleaseTrack[]
  links: ReleaseLink[]
  photos: ReleasePhoto[]
}

export interface ReleaseTrackLinkPayload {
  platform: ReleasePlatform
  url: string
}

export interface ReleaseTrackPayload {
  title: string
  duration: string | null
  lyrics: string | null
  sort_order: number
  bpm: number | null
  musical_key: string | null
  mood_tags: string | null
  isrc: string | null
  explicit: boolean
  stems_available: boolean
  sync_placements: string | null
  links: ReleaseTrackLinkPayload[]
}

export interface ReleaseLinkPayload {
  platform: ReleasePlatform
  url: string
}

export interface ReleasePayload {
  title: string | TranslationMap
  slug_en?: string | null
  slug_pl?: string | null
  type: ReleaseType
  release_date: string | null
  description: string | TranslationMap | null
  is_upcoming: boolean
  presave_url: string | null
  label_name: string | null
  links: ReleaseLinkPayload[]
  tracks: ReleaseTrackPayload[]
}
