import type { Venue } from './venue'
import type { Tag } from './tag'

export interface ConcertBand {
  id: number
  name: string
  website: string | null
  sort_order: number
  play_time: string | null
}

export interface ConcertLink {
  id: number
  label: string
  url: string
}

export interface Concert {
  id: number
  date: string
  doors_open: string | null
  sound_check_time: string | null
  start_time: string | null
  own_sort_order: number
  description: string | null
  poster_url: string | null
  venue: Venue
  bands: ConcertBand[]
  tags?: Tag[]
  links?: ConcertLink[]
  created_at: string
  updated_at: string
}

export interface ConcertBandPayload {
  id: number
  sort_order: number
  play_time?: string | null
}

export interface ConcertLinkPayload {
  label: string
  url: string
}

export interface ConcertPayload {
  venue_id: number
  date: string
  doors_open?: string | null
  sound_check_time?: string | null
  start_time?: string | null
  own_sort_order?: number
  description?: string | null
  bands?: ConcertBandPayload[]
  tag_ids?: number[]
  links?: ConcertLinkPayload[]
}
