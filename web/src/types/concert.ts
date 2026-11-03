import type { Venue } from './venue'
import type { Tag } from './tag'
import type { Clip } from './clip'

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
  /** The default locale's slug — every concert URL, in every language. Same value as the old `slug_en`. */
  slug: string
  date: string
  doors_open: string | null
  start_time: string | null
  own_sort_order: number
  /** Our band's stage time; null means it plays at `start_time`. Absent on older API responses. */
  own_play_time?: string | null
  /** Print "Headliner" / "Support" under each act of the line-up. */
  show_lineup_roles: boolean
  description: string | null
  poster_url: string | null
  venue: Venue
  bands: ConcertBand[]
  tags?: Tag[]
  links?: ConcertLink[]
  /** External ticket shop, set in the admin. Absent on older API responses. */
  ticket_url?: string | null
  /** How many of our own ticket types exist. */
  ticket_types_count?: number
  clips?: Clip[]
  translations?: {
    name?:        { en?: string | null; pl?: string | null }
    description?: { en?: string | null; pl?: string | null }
  }
  created_at: string
  updated_at: string
}
