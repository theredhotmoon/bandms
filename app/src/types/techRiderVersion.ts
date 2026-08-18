/**
 * A published rider version — an immutable copy taken when the rider was sent.
 *
 * The stored snapshot is not the printed sheet: it is what the sheet is derived
 * *from* (the rider, the rigs its placements reference, the musicians placed on
 * it). @/utils/riderResolver turns it into channels and monitors here exactly as
 * it does for the live editor, so there is still one implementation of the
 * derivation rules rather than one per surface.
 */

import type { BandMember } from './bandMember'
import type { TechRider } from './techRider'

/** `published` is the one the rider's QR code serves; the rest are `archived`. */
export type TechRiderVersionStatus = 'published' | 'archived'

export interface TechRiderVersion {
  id: number
  tech_rider_id: number
  version_number: number
  notes: string | null
  status: TechRiderVersionStatus
  /** This version's own permalink — keeps working after a newer one is published. */
  public_token: string
  published_at: string | null
  created_at: string
}

export interface TechRiderVersionPayload {
  notes?: string | null
}

/** Band identity as it appeared on the sheet — a later rebrand does not rewrite it. */
export interface SnapshotProfile {
  name: string | null
  logo_url: string | null
}

/**
 * What `GET /api/public/rider/{token}` returns: the frozen snapshot plus the
 * metadata of the version it came from.
 */
export interface PublishedRider {
  /** Snapshot shape version — bumped if the payload below ever changes. */
  format: number
  taken_at: string
  rider: TechRider
  /** Only the musicians this rider places, with only what the sheet prints. */
  members: BandMember[]
  profile: SnapshotProfile
  version: TechRiderVersion
}
