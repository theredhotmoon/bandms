import type { Tag } from './tag'
import type { SocialLinkPayload } from './socialLink'

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
  social_links?: SocialLinkPayload[]
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
  social_links?: SocialLinkPayload[]
}
