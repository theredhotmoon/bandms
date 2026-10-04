import type { TranslationMap } from './shared'
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
  /** Band members who played this show — linked explicitly; line-ups change. */
  member_ids?: number[]
  name: string | null
  /** The default locale's slug — every concert URL, in every language. */
  slug: string
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
  /** Attached through the clips library — read-only here, written via /api/clips. */
  clips?: Clip[]
  translations?: {
    name?:        TranslationMap
    description?: TranslationMap
    slug?:        TranslationMap
  }
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
  name?: TranslationMap | null
  description?: TranslationMap | null
  venue_id: number
  date: string
  /** A null locale is generated (on create) or cleared/kept (on update) by the API. */
  slug?: TranslationMap
  doors_open?: string | null
  sound_check_time?: string | null
  start_time?: string | null
  own_sort_order?: number
  bands?: ConcertBandPayload[]
  tag_ids?: number[]
  member_ids?: number[]
  links?: ConcertLinkPayload[]
}
