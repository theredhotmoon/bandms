import type { SocialLink } from './socialLink'

/**
 * An instrument a member plays. `BandMemberResource` has always sent these;
 * they were simply absent from this interface, which is why the public site
 * never showed a member's instruments.
 */
export interface MemberInstrument {
  id: number
  name: string
  category: string | null
}

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
  /** Set for former members. */
  quit_at: string | null
  sort_order: number
  main_instrument: MemberInstrument | null
  instruments: MemberInstrument[]
  social_links: SocialLink[]
  created_at: string
  updated_at: string
}
