export type SetlistTransition = 'pause' | 'segue' | 'talk' | 'end'

export interface PublicSetlistSong {
  id: number
  title: string
  duration_sec: number | null
}

export interface PublicSetlistItem {
  id: number
  position: number
  is_encore: boolean
  transition: SetlistTransition | null
  override_duration_sec: number | null
  song: PublicSetlistSong | null
}

export interface PublicSetlist {
  id: number
  name: string
  concert_id: number | null
  items: PublicSetlistItem[]
  total_duration_sec: number | null
}
