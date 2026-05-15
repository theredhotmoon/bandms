import type { SocialLink, SocialLinkPayload } from './socialLink'
import type { Instrument } from './instrument'

export interface BandMember {
  id: number
  band_id: number
  first_name: string
  last_name: string
  bio: string | null
  photo: string | null
  role: string | null
  is_current: boolean
  joined_at: string | null
  quit_at: string | null
  sort_order: number
  calendar_url: string | null
  login_email: string | null
  can_login: boolean
  instruments: Instrument[]
  social_links: SocialLink[]
  created_at: string
  updated_at: string
}

export interface BandMemberPayload {
  first_name: string
  last_name: string
  bio?: string | null
  photo?: string | null
  role?: string | null
  is_current?: boolean
  joined_at?: string | null
  quit_at?: string | null
  sort_order?: number
  calendar_url?: string | null
  login_email?: string | null
  can_login?: boolean
  instrument_ids?: number[]
  social_links?: SocialLinkPayload[]
}
