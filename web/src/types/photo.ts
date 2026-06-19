export interface Photo {
  id: number
  album_id: number | null
  image_url: string | null
  sort_order: number
  caption: string | null
  created_at: string
  updated_at: string
}
