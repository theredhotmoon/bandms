/** A person to contact about a band — an `Author` row, surfaced on the band. */
export interface BandContact {
  id: number
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
}

export interface Band {
  id: number
  name: string
  website: string | null
  gigs_count: number
  last_gig_at: string | null
  contacts: BandContact[]
  created_at: string
  updated_at: string
}

export interface BandPayload {
  name: string
  website?: string | null
  author_ids?: number[]
}
