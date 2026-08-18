/**
 * A tech rider.
 *
 * The rider stores placements (who plays what, where, through which saved rig)
 * and the handful of requirements that belong to no single musician. The
 * printed lists — channels, monitors, backline, power positions, RF — are
 * derived from the placements by @/utils/riderResolver and are never stored.
 */

import type { BandMemberSetup } from './bandMemberSetup'
import type { GigLineup, StagePlacement } from './stagePlot'
import type { BacklineSpec, InputRow, MonitorSpec, WirelessSpec } from './rig'

// Re-exported so existing imports of the rig vocabulary via this module keep
// resolving to the single definition rather than tempting a second one.
export type {
  BacklineCategory,
  BacklineSpec,
  InputRow,
  MicDiChoice,
  MonitorConfig,
  MonitorSpec,
  MonitorType,
  PowerSpec,
  RigOverride,
  RigSpec,
  SignalChainType,
  WirelessSpec,
  WirelessType,
} from './rig'
export type { StagePlotItemType } from './instrumentType'

// ── PA / FOH — a production-level section, not a per-musician one ────────────

export interface PaFohRequirements {
  room_coverage_notes: string
  subwoofer_notes: string
  processing_notes: string
  console_preference: string
  brings_own_foh_engineer: boolean
  foh_engineer_name: string
  brings_show_file: boolean
  show_file_format: string
}

// ── Power — stage-wide figures; per-position outlets come from placements ────

export interface PowerNotes {
  total_wattage: number | null
  needs_clean_power: boolean
  general_notes: string
}

// ── Rider ────────────────────────────────────────────────────────────────────

export interface TechRiderConcert {
  id: number
  date: string
  venue: string | null
}

export interface TechRider {
  id: number
  profile_id: number
  name: string
  is_active: boolean
  public_token: string
  concert_id: number | null
  concert?: TechRiderConcert | null

  gig_lineup: GigLineup
  placements: StagePlacement[]

  /**
   * Every setup the placements reference, sent with the rider so the public
   * token view resolves them with the same code as the admin editor.
   * Keyed by setup id (JSON object keys arrive as strings).
   */
  referenced_setups: Record<string, BandMemberSetup>

  /** Requirements that belong to the production: talkback, playback, side fills. */
  extra_inputs: InputRow[]
  extra_monitors: MonitorSpec[]
  extra_backline: BacklineSpec[]
  extra_wireless: WirelessSpec[]

  /** Engineer-chosen channel order, as resolved row keys. */
  channel_order: string[]

  power_notes: PowerNotes
  pa_foh: PaFohRequirements

  created_at: string
  updated_at: string
}

export interface TechRiderSummary {
  id: number
  name: string
  is_active: boolean
  public_token: string
  concert_id: number | null
  updated_at: string
}

export interface TechRiderPayload {
  name?: string
  is_active?: boolean
  concert_id?: number | null
  gig_lineup?: GigLineup
  placements?: StagePlacement[]
  extra_inputs?: InputRow[]
  extra_monitors?: MonitorSpec[]
  extra_backline?: BacklineSpec[]
  extra_wireless?: WirelessSpec[]
  channel_order?: string[]
  power_notes?: PowerNotes
  pa_foh?: PaFohRequirements
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export function defaultPaFoh(): PaFohRequirements {
  return {
    room_coverage_notes: '',
    subwoofer_notes: '',
    processing_notes: '',
    console_preference: '',
    brings_own_foh_engineer: false,
    foh_engineer_name: '',
    brings_show_file: false,
    show_file_format: '',
  }
}

export function defaultPowerNotes(): PowerNotes {
  return { total_wattage: null, needs_clean_power: false, general_notes: '' }
}
