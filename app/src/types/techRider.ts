// ── Stage Plot ───────────────────────────────────────────────────────────────

export type StagePlotItemType =
  | 'drums'
  | 'guitar_amp'
  | 'bass_amp'
  | 'keyboard'
  | 'vocalist'
  | 'monitor_wedge'
  | 'di_box'
  | 'rack'
  | 'acoustic_guitar'
  | 'violin'
  | 'brass'
  | 'custom'

// Legacy single-instrument item (kept for type reference only)
export interface StagePlotItem {
  id: string
  type: StagePlotItemType
  label: string
  x: number
  y: number
  inputNumber?: number | null
  band_member_id?: number | null
  setup_id?: number | null
}

// ── Inputs List ─────────────────────────────────────────────────────────────

export type MicDiChoice = 'Mic' | 'DI' | 'Mic+DI'

export interface InputRow {
  id: string
  channel: number
  instrument: string
  mic_di: MicDiChoice
  mic_model: string
  stand_type: string
  notes: string
}

// ── Monitor / IEM ────────────────────────────────────────────────────────────

export type MonitorType = 'wedge' | 'iem'

export interface MonitorMix {
  id: string
  band_member_id: number | null
  custom_name: string       // used when band_member_id is null
  type: MonitorType
  mix_description: string   // e.g. "guitar heavy + click"
  iem_own_pack: boolean
  transmitter_model: string
  frequency: string
}

// ── Backline ─────────────────────────────────────────────────────────────────

export type BacklineCategory = 'drum_kit' | 'guitar_amp' | 'bass_amp' | 'keyboard' | 'other'

export interface BacklineItem {
  id: string
  category: BacklineCategory
  name: string
  brand_preference: string
  specs: string
  notes: string
}

// ── PA / FOH ─────────────────────────────────────────────────────────────────

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

// ── Power ────────────────────────────────────────────────────────────────────

export interface PowerPosition {
  id: string
  location: string
  outlets_needed: number
  notes: string
}

export interface PowerRequirements {
  total_wattage: number | null
  needs_clean_power: boolean
  general_notes: string
  positions: PowerPosition[]
}

// ── RF / Wireless ─────────────────────────────────────────────────────────────

export interface RfWirelessUnit {
  id: string
  model: string
  type: string
  frequency_band: string
  programmed_frequency: string
  notes: string
}

// ── Top-level TechRider ───────────────────────────────────────────────────────

import type { GigLineup, StagePlotMemberItem } from './stagePlot'

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
  stage_plot_data: StagePlotMemberItem[]
  inputs: InputRow[]
  monitors: MonitorMix[]
  backline: BacklineItem[]
  pa_foh: PaFohRequirements
  power: PowerRequirements
  rf_wireless: RfWirelessUnit[]
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
  stage_plot_data?: StagePlotMemberItem[]
  inputs?: InputRow[]
  monitors?: MonitorMix[]
  backline?: BacklineItem[]
  pa_foh?: PaFohRequirements
  power?: PowerRequirements
  rf_wireless?: RfWirelessUnit[]
}

// ── Default factories ─────────────────────────────────────────────────────────

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

export function defaultPower(): PowerRequirements {
  return {
    total_wattage: null,
    needs_clean_power: false,
    general_notes: '',
    positions: [],
  }
}
