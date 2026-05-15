export interface Band {
  id: number
  name: string
  website: string | null
  gigs_count: number
  last_gig_at: string | null
  created_at: string
  updated_at: string
}

export interface BandPayload {
  name: string
  website?: string | null
}
