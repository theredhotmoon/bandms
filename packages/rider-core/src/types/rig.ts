/**
 * rig.ts — the one vocabulary for "what one musician needs on stage".
 *
 * A saved band-member setup IS a rig. A rider placement references a saved rig
 * and patches it with a sparse override of the same shape. The rider's printed
 * lists are derived from those rigs (see @/utils/riderResolver).
 *
 * Nothing else may define its own monitor / backline / power / wireless shape.
 * Adding a field here means adding it to App\Http\Requests\Concerns\ValidatesRig
 * on the backend as well.
 */

// ── Signal chain ──────────────────────────────────────────────────────────────
// Keep in sync with App\Enums\SignalChainType.

export type SignalChainType =
  | 'modeler_mono'
  | 'modeler_stereo'
  | 'amp_mic'
  | 'amp_mic_di'
  | 'amp_di'
  | 'direct_mono'
  | 'direct_stereo'
  | 'drum_acoustic'
  | 'drum_electronic'
  | 'drum_hybrid'
  | 'vocal_mic'
  | 'vocal_wireless'
  | 'acoustic_di'
  | 'acoustic_mic'
  | 'acoustic_mic_di'
  | 'other'

// ── Inputs ────────────────────────────────────────────────────────────────────

export type MicDiChoice = 'Mic' | 'DI' | 'Mic+DI'

/**
 * One channel. Deliberately has no `channel` number: numbering is assigned when
 * the rider is resolved, so a stored number could only ever go stale or collide.
 */
export interface InputRow {
  id: string
  instrument: string
  mic_di: MicDiChoice
  mic_model: string
  stand_type: string
  notes: string
}

// ── Monitors ──────────────────────────────────────────────────────────────────

export type MonitorType = 'wedge' | 'iem'
export type MonitorConfig = 'mono' | 'stereo'

export interface MonitorSpec {
  id: string
  label: string
  type: MonitorType
  config: MonitorConfig
  mix_description: string
  iem_own_pack: boolean
  iem_transmitter_model: string
  iem_frequency: string
}

// ── Backline ──────────────────────────────────────────────────────────────────

export type BacklineCategory = 'drum_kit' | 'guitar_amp' | 'bass_amp' | 'keyboard' | 'other'

export interface BacklineSpec {
  id: string
  /** false = the musician brings it; true = the promoter must provide it. */
  needed: boolean
  category: BacklineCategory
  name: string
  brand_preference: string
  specs: string
  notes: string
}

// ── Power ─────────────────────────────────────────────────────────────────────

export interface PowerSpec {
  outlets_needed: number
  notes: string
}

// ── Wireless ──────────────────────────────────────────────────────────────────

export type WirelessType = 'instrument' | 'vocal' | 'iem' | 'other'

export interface WirelessSpec {
  id: string
  type: WirelessType
  brand_model: string
  frequency_band: string
  own_unit: boolean
  notes: string
}

// ── The rig ───────────────────────────────────────────────────────────────────

export interface RigSpec {
  signal_chain_type: SignalChainType
  inputs: InputRow[]
  monitors: MonitorSpec[]
  backline: BacklineSpec[]
  power: PowerSpec
  wireless: WirelessSpec[]
  foh_notes: string
}

/** The keys a placement may override. Absent key = inherit from the saved rig. */
export type RigField = keyof RigSpec

export const RIG_FIELDS: RigField[] = [
  'signal_chain_type',
  'inputs',
  'monitors',
  'backline',
  'power',
  'wireless',
  'foh_notes',
]

/** A sparse patch over a saved rig — only the fields this gig changes. */
export type RigOverride = Partial<RigSpec>

// ── Defaults ──────────────────────────────────────────────────────────────────

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function defaultPowerSpec(): PowerSpec {
  return { outlets_needed: 2, notes: '' }
}

export function defaultMonitorSpec(label = 'Stage monitor'): MonitorSpec {
  return {
    id: uid('mon'),
    label,
    type: 'wedge',
    config: 'mono',
    mix_description: '',
    iem_own_pack: false,
    iem_transmitter_model: '',
    iem_frequency: '',
  }
}

export function defaultBacklineSpec(): BacklineSpec {
  return {
    id: uid('bl'),
    needed: true,
    category: 'other',
    name: '',
    brand_preference: '',
    specs: '',
    notes: '',
  }
}

export function defaultWirelessSpec(): WirelessSpec {
  return {
    id: uid('rf'),
    type: 'instrument',
    brand_model: '',
    frequency_band: '',
    own_unit: true,
    notes: '',
  }
}

export function defaultInputRow(instrument = ''): InputRow {
  return {
    id: uid('in'),
    instrument,
    mic_di: 'Mic',
    mic_model: '',
    stand_type: '',
    notes: '',
  }
}

export function defaultRigSpec(): RigSpec {
  return {
    signal_chain_type: 'other',
    inputs: [],
    monitors: [],
    backline: [],
    power: defaultPowerSpec(),
    wireless: [],
    foh_notes: '',
  }
}
