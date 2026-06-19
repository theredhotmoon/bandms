export interface MusicVideo {
  id: number
  title: string
  video_url: string
  published_at: string | null
  sort_order: number
  og_title: string | null
  og_image: string | null
  channel_name: string | null
  duration: string | null
  view_count: number | null
  created_at: string
  updated_at: string
}
