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
  created_at: string
  updated_at: string
}

export interface MusicVideoPayload {
  title: string
  video_url: string
  published_at: string | null
  sort_order: number
}
