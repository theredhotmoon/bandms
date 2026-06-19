import type { SocialLink } from './socialLink'

export interface BandMember {
  id: number
  first_name: string
  nickname: string | null
  last_name: string
  bio: string | null
  photo: string | null
  role: string | null
  is_current: boolean
  joined_at: string | null
  sort_order: number
  social_links: SocialLink[]
  created_at: string
  updated_at: string
}
