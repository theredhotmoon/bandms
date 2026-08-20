/**
 * "Has this musician confirmed their rig for this gig?"
 *
 * Distinct from completeness, which only says whether a rig *looks* filled in.
 * A rig saved in March is complete and may still be wrong for tonight; this
 * records that someone asked, and that the musician answered.
 */

export interface RiderConfirmation {
  id: number
  tech_rider_id: number
  band_member_id: number
  /** Present when the confirmation was loaded with its member — admin lists. */
  member_name?: string | null
  requested_at: string | null
  /** null while the request is outstanding. */
  confirmed_at: string | null
  /** Present on the "waiting on you" list a musician sees. */
  rider?: {
    id: number
    name: string
    concert: { date: string; venue: string | null } | null
  }
}

/** The result of asking the band — some addresses can bounce. */
export interface ConfirmationRequestResult {
  data: RiderConfirmation[]
  requested: number
  /** Band member ids whose mail could not be sent. */
  failed: number[]
}
