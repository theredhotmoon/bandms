/** A person to contact about a band — an `Author` row, surfaced on the band. */
export interface BandContact {
  id: number
  /** "First Last", for display and the recipient box. */
  name: string
  /** What the pitch greets them by. */
  first_name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
}

export type BandKind = 'band' | 'promoter' | 'festival'

export interface Band {
  id: number
  name: string
  /** A promoter or festival is a band row with another kind — one place for "who books shows". */
  kind?: BandKind
  country?: string | null
  website: string | null
  gigs_count: number
  last_gig_at: string | null
  contacts: BandContact[]
  created_at: string
  updated_at: string
}

export interface BandPayload {
  name: string
  kind?: BandKind
  country?: string | null
  website?: string | null
  author_ids?: number[]
}
