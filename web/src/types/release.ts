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
  isrc: string | null
  explicit: boolean
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
  title: string
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
    title:        { en?: string | null; pl?: string | null }
    description?: { en?: string | null; pl?: string | null }
  }
}

export interface Release extends ReleaseSummary {
  description: string | null
  tracks: ReleaseTrack[]
  photos: ReleasePhoto[]
}

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  LP:          'Album',
  EP:          'EP',
  single:      'Single',
  compilation: 'Compilation',
}

export const PLATFORM_LABELS: Record<ReleasePlatform, string> = {
  spotify:     'Spotify',
  apple_music: 'Apple Music',
  bandcamp:    'Bandcamp',
  youtube:     'YouTube',
  instagram:   'Instagram',
}
