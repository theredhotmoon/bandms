/**
 * The stage plot: who stands where, and whose saved rig they are playing.
 *
 * A placement is a *reference* (`setup_id`) plus a sparse per-gig `overrides`
 * patch — never a copy of the rig. Everything printed on the rider is derived
 * from these placements by @/utils/riderResolver.
 */

import type { StagePlotItemType } from './instrumentType'
import type { RigOverride } from './rig'
import { INSTRUMENT_ICON_CATALOG } from '@/utils/instrumentIcons'
import { uid } from './rig'

// ── Gig lineup (who's playing tonight) ───────────────────────────────────────

export interface GigRegularMember {
  band_member_id: number
  is_available: boolean
}

export interface GigTempMusician {
  id: string
  name: string
  role: string
}

export interface GigLineup {
  regular_members: GigRegularMember[]
  temp_musicians: GigTempMusician[]
}

// ── Placements ───────────────────────────────────────────────────────────────

/**
 * A visual instrument slot — icon + label shown on the stage canvas.
 *
 * Deliberately carries no rig of its own: which rig a musician plays is a
 * property of the placement, not of one icon on it.
 */
export interface PlacedInstrument {
  id: string
  type: StagePlotItemType
  label: string
}

export interface StagePlacement {
  id: string
  /** Set for a regular member; null for a guest (see temp_id). */
  band_member_id: number | null
  /** Set for a guest musician from the gig lineup. */
  temp_id?: string
  /** The saved rig this placement uses. null = fully ad-hoc (guests, one-offs). */
  setup_id: number | null
  x: number
  y: number
  instruments: PlacedInstrument[]
  /** Only what differs from the saved rig for this gig. Usually empty. */
  overrides: RigOverride
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export function defaultGigLineup(): GigLineup {
  return { regular_members: [], temp_musicians: [] }
}

export function defaultPlacedInstrument(): PlacedInstrument {
  return { id: uid('inst'), type: 'vocalist', label: '' }
}

export function defaultPlacement(
  band_member_id: number | null,
  temp_id: string | undefined,
  x: number,
  y: number,
): StagePlacement {
  return {
    id: uid('pos'),
    band_member_id,
    temp_id,
    setup_id: null,
    x,
    y,
    instruments: [],
    overrides: {},
  }
}

// ── Instrument type labels ───────────────────────────────────────────────────
// Sourced from the icon catalogue so a new icon is declared in one place only.

export const INSTRUMENT_TYPE_LABELS = Object.fromEntries(
  INSTRUMENT_ICON_CATALOG.map((def) => [def.type, def.label]),
) as Record<StagePlotItemType, string>

export const INSTRUMENT_PALETTE: { type: StagePlotItemType; label: string }[] =
  INSTRUMENT_ICON_CATALOG.map((def) => ({ type: def.type, label: def.label }))
