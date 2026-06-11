export interface MusicVideo {
  id: number
  profile_id: number
  title: string
  video_url: string
  published_at: string | null
  sort_order: number
  og_title: string | null
  og_image: string | null
  og_site_name: string | null
  channel_name: string | null
  duration: string | null
  view_count: number | null
  views_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface VideoMetadata {
  title: string | null
  thumbnail_url: string | null
  channel_name: string | null
  provider_name: string | null
  view_count: number | null
  duration: string | null
}

export interface YouTubeSyncResult {
  message: string
  updated: number
  skipped: number
  total_views: number
  synced_at: string
  results: { id: number; title: string; view_count: number }[]
}

export interface MusicVideoPayload {
  title: string
  video_url: string
  published_at: string | null
  sort_order: number
  og_image?: string | null
  og_title?: string | null
  channel_name?: string | null
  view_count?: number | null
  duration?: string | null
}
