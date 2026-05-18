export interface Song {
  id: number
  title: string
  duration_sec: number | null
  bpm: number | null
  key: string | null
  notes: string
  updated_at: string
}

export interface SongPayload {
  title: string
  duration_sec?: number | null
  bpm?: number | null
  key?: string | null
  notes?: string
}
