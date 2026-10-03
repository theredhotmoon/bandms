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

export interface MemberGearItem {
  id: string
  type: import('@bandms/rider-core').DefaultGearItemType
  label: string
  brand_model: string
}

export interface MemberPhoto {
  id: number
  url: string
  caption: string | null
}

export interface BandMember {
  id: number
  first_name: string
  nickname: string | null
  last_name: string
  /** The member's page, /{lang}/{about}/{slug}. Generated once; never follows a rename. */
  slug: string
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
  /**
   * Photos the member is tagged in, from published albums only. Optional:
   * an API predating member tagging omits it.
   */
  photos?: MemberPhoto[]
  /**
   * The member's own gear. The API sends more (notes, own_gear) than the page
   * shows: those are tech-rider details, not part of a public postcard.
   */
  default_gear?: MemberGearItem[]
  created_at: string
  updated_at: string
}
