import type { Tag } from './tag'

export interface Venue {
  id: number
  name: string
  street: string | null
  street_number: string | null
  city: string | null
  postcode: string | null
  additional_info: string | null
  capacity: number | null
  latitude: number | null
  longitude: number | null
  tags?: Tag[]
  created_at: string
  updated_at: string
}

export interface VenuePayload {
  name: string
  street?: string | null
  street_number?: string | null
  city?: string | null
  postcode?: string | null
  additional_info?: string | null
  capacity?: number | null
  latitude?: number | null
  longitude?: number | null
  tag_ids?: number[]
}
