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
  name: string | null
  slug_en: string
  date: string
  doors_open: string | null
  start_time: string | null
  own_sort_order: number
  description: string | null
  poster_url: string | null
  venue: Venue
  bands: ConcertBand[]
  tags?: Tag[]
  links?: ConcertLink[]
  translations?: {
    name?:        { en?: string | null; pl?: string | null }
    description?: { en?: string | null; pl?: string | null }
  }
  created_at: string
  updated_at: string
}
