import type { Song } from './song'

export type SetlistTransition = 'pause' | 'segue' | 'talk' | 'end'

export interface SetlistItem {
  id: number
  setlist_id: number
  song_id: number
  song: Song
  position: number
  is_encore: boolean
  transition: SetlistTransition | null
  lighting_cue: string
  sound_note: string
  member_notes: Record<string, string>
  override_duration_sec: number | null
}

export interface SetlistItemPayload {
  song_id?: number
  is_encore?: boolean
  transition?: SetlistTransition | null
  lighting_cue?: string
  sound_note?: string
  member_notes?: Record<string, string>
  override_duration_sec?: number | null
}

export interface SetlistConcert {
  id: number
  date: string | null
  venue: string | null
}

export interface SetlistSummary {
  id: number
  name: string
  setlistfm_id: string | null
  concert_id: number | null
  concert_date: string | null
  concert_venue: string | null
  item_count: number
  total_duration_sec: number | null
  updated_at: string
}

export interface Setlist {
  id: number
  name: string
  setlistfm_id: string | null
  concert_id: number | null
  concert: SetlistConcert | null
  foh_notes: string
  lighting_notes: string
  items: SetlistItem[]
  total_duration_sec: number | null
  created_at: string
  updated_at: string
}

export interface SetlistPayload {
  name?: string
  concert_id?: number | null
  setlistfm_id?: string | null
  foh_notes?: string
  lighting_notes?: string
}

// setlist.fm search types

export interface SetlistFmArtist {
  mbid: string
  name: string
}

export interface SetlistFmSong {
  title: string
  is_encore: boolean
}

export interface SetlistFmSetlist {
  id: string
  event_date: string | null
  venue: string
  song_count: number
  songs: SetlistFmSong[]
}
