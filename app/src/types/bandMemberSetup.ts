import type { InputRow } from './techRider'

// ── Signal chain types ────────────────────────────────────────────────────────

export type SignalChainType =
  | 'modeler_mono'     // Modeler/profiler, mono DI out
  | 'modeler_stereo'   // Modeler/profiler, stereo DI out (L+R)
  | 'amp_mic'          // Guitar/bass amp, mic only
  | 'amp_mic_di'       // Guitar/bass amp, mic + parallel DI
  | 'amp_di'           // Guitar/bass amp, line/cab-sim DI
  | 'direct_mono'      // Straight DI, mono
  | 'direct_stereo'    // Straight DI, stereo (L+R)
  | 'drum_acoustic'    // Full acoustic kit (10-ch standard)
  | 'drum_electronic'  // Electronic / pad kit, DI out
  | 'drum_hybrid'      // Hybrid kit (acoustic mics + trigger DI)
  | 'vocal_mic'        // Stand mic (wired handheld)
  | 'vocal_wireless'   // Wireless handheld
  | 'acoustic_di'      // Acoustic instrument, DI only
  | 'acoustic_mic'     // Acoustic instrument, mic only
  | 'acoustic_mic_di'  // Acoustic instrument, mic + DI
  | 'other'            // Custom / fully manual

// ── Monitor preferences (per member) ─────────────────────────────────────────

export type MonitorConfig = 'mono' | 'stereo'

export interface MemberMonitorPrefs {
  type: 'wedge' | 'iem'
  config: MonitorConfig
  mix_description: string
  iem_own_pack: boolean
  iem_transmitter_model: string
  iem_frequency: string
}

// ── Backline preferences ──────────────────────────────────────────────────────

export interface MemberBacklinePrefs {
  needed: boolean
  category: string         // BacklineCategory string
  brand_preference: string
  specs: string
  notes: string
}

// ── Power preferences ─────────────────────────────────────────────────────────

export interface MemberPowerPrefs {
  outlets_needed: number
  notes: string
}

// ── Wireless preferences ──────────────────────────────────────────────────────

export type WirelessUnitType = 'instrument' | 'vocal' | 'iem' | 'other'

export interface WirelessUnit {
  type: WirelessUnitType
  brand_model: string
  frequency_band: string
  own_unit: boolean
  notes: string
}

export interface MemberWirelessPrefs {
  units: WirelessUnit[]
}

// ── Top-level setup ───────────────────────────────────────────────────────────

export interface BandMemberSetup {
  id: number
  band_member_id: number
  instrument_id: number | null
  shared_monitor_id: number | null
  name: string
  is_default: boolean
  signal_chain_type: SignalChainType
  inputs: InputRow[]
  monitor: MemberMonitorPrefs
  backline: MemberBacklinePrefs
  power: MemberPowerPrefs
  wireless: WirelessUnit[]
  foh_notes: string
  created_at: string
  updated_at: string
}

export interface BandMemberSetupSummary {
  id: number
  band_member_id: number
  instrument_id: number | null
  instrument_name: string | null
  shared_monitor_id: number | null
  name: string
  is_default: boolean
  signal_chain_type: SignalChainType
  input_count: number
  updated_at: string
}

export interface BandMemberSetupPayload {
  name?: string
  is_default?: boolean
  instrument_id?: number | null
  shared_monitor_id?: number | null
  signal_chain_type?: SignalChainType
  inputs?: InputRow[]
  monitor?: MemberMonitorPrefs
  backline?: MemberBacklinePrefs
  power?: MemberPowerPrefs
  wireless?: WirelessUnit[]
  foh_notes?: string
}

// ── For the tech-rider import panel ──────────────────────────────────────────

export interface MemberSetupGroup {
  member_id: number
  member_name: string
  member_role: string | null
  setups: BandMemberSetup[]
}

// ── Default factories ─────────────────────────────────────────────────────────

export function defaultMonitorPrefs(): MemberMonitorPrefs {
  return {
    type: 'wedge',
    config: 'mono',
    mix_description: '',
    iem_own_pack: false,
    iem_transmitter_model: '',
    iem_frequency: '',
  }
}

export function defaultBacklinePrefs(): MemberBacklinePrefs {
  return {
    needed: false,
    category: 'other',
    brand_preference: '',
    specs: '',
    notes: '',
  }
}

export function defaultPowerPrefs(): MemberPowerPrefs {
  return { outlets_needed: 2, notes: '' }
}

export function defaultWirelessPrefs(): MemberWirelessPrefs {
  return { units: [] }
}

export function defaultWirelessUnit(): WirelessUnit {
  return { type: 'instrument', brand_model: '', frequency_band: '', own_unit: true, notes: '' }
}
