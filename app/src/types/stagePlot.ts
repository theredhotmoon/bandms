import type { StagePlotItemType, InputRow } from './techRider'
import type { SignalChainType, MemberBacklinePrefs, MemberPowerPrefs, WirelessUnit } from './bandMemberSetup'
import { defaultBacklinePrefs, defaultPowerPrefs } from './bandMemberSetup'

// ── Gig lineup (who's playing tonight) ───────────────────────────────────────

export interface GigLineup {
  regular_members: GigRegularMember[]
  temp_musicians: GigTempMusician[]
}

export interface GigRegularMember {
  band_member_id: number
  is_available: boolean
}

export interface GigTempMusician {
  id: string
  name: string
  role: string
}

// ── Stage positions (member-centric) ─────────────────────────────────────────

export interface StagePlotMemberItem {
  id: string
  band_member_id: number | null  // null = temp musician
  temp_id?: string               // reference to GigTempMusician.id
  x: number                      // 0-100 %
  y: number                      // 0-100 %
  instruments: PlacedInstrument[]
  monitors: PlacedMonitor[]
  backline: MemberBacklinePrefs
  power: MemberPowerPrefs
  wireless: WirelessUnit[]
  foh_notes: string
}

export interface PlacedInstrument {
  id: string
  type: StagePlotItemType
  label: string
  setup_id: number | null
  signal_chain_type: SignalChainType
  inputs: InputRow[]
}

export interface PlacedMonitor {
  id: string
  type: 'wedge' | 'iem'
  label: string
  mix_description: string
  iem_own_pack: boolean
  transmitter_model: string
  frequency: string
}

// ── Default factories ─────────────────────────────────────────────────────────

export function defaultGigLineup(): GigLineup {
  return { regular_members: [], temp_musicians: [] }
}

export function defaultPlacedInstrument(): PlacedInstrument {
  return {
    id: uid('inst'),
    type: 'vocalist',
    label: '',
    setup_id: null,
    signal_chain_type: 'other',
    inputs: [],
  }
}

export function defaultPlacedMonitor(): PlacedMonitor {
  return {
    id: uid('mon'),
    type: 'wedge',
    label: 'Stage Monitor',
    mix_description: '',
    iem_own_pack: false,
    transmitter_model: '',
    frequency: '',
  }
}

export function defaultStageMemberItem(
  band_member_id: number | null,
  temp_id: string | undefined,
  x: number,
  y: number,
): StagePlotMemberItem {
  return {
    id: uid('pos'),
    band_member_id,
    temp_id,
    x,
    y,
    instruments: [],
    monitors: [],
    backline: defaultBacklinePrefs(),
    power: defaultPowerPrefs(),
    wireless: [],
    foh_notes: '',
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Completeness helpers ──────────────────────────────────────────────────────

export function isMemberItemComplete(item: StagePlotMemberItem): boolean {
  return (
    item.instruments.length > 0 &&
    item.instruments.every(i => i.inputs.length > 0) &&
    item.monitors.length > 0
  )
}

export function isMemberItemPartial(item: StagePlotMemberItem): boolean {
  return !isMemberItemComplete(item) && (
    item.instruments.length > 0 || item.monitors.length > 0
  )
}

export function computeCompleteness(items: StagePlotMemberItem[]): {
  total: number
  complete: number
  partial: number
  pct: number
} {
  if (items.length === 0) return { total: 0, complete: 0, partial: 0, pct: 0 }
  const complete = items.filter(isMemberItemComplete).length
  const partial  = items.filter(isMemberItemPartial).length
  return {
    total: items.length,
    complete,
    partial,
    pct: Math.round((complete / items.length) * 100),
  }
}

// ── Instrument type label map ─────────────────────────────────────────────────

export const INSTRUMENT_TYPE_LABELS: Record<StagePlotItemType, string> = {
  drums:          'Drum Kit',
  guitar_amp:     'Guitar Amp',
  bass_amp:       'Bass Amp',
  keyboard:       'Keyboard',
  vocalist:       'Vocalist',
  acoustic_guitar:'Acoustic Guitar',
  violin:         'Violin',
  brass:          'Brass',
  monitor_wedge:  'Monitor Wedge',
  di_box:         'DI Box',
  rack:           'Rack Unit',
  custom:         'Custom',
}

export const INSTRUMENT_PALETTE: { type: StagePlotItemType; label: string }[] = [
  { type: 'vocalist',       label: 'Vocalist'        },
  { type: 'guitar_amp',     label: 'Guitar Amp'      },
  { type: 'bass_amp',       label: 'Bass Amp'        },
  { type: 'acoustic_guitar',label: 'Acoustic Guitar' },
  { type: 'keyboard',       label: 'Keyboard'        },
  { type: 'drums',          label: 'Drum Kit'        },
  { type: 'violin',         label: 'Violin'          },
  { type: 'brass',          label: 'Brass'           },
  { type: 'di_box',         label: 'DI Box'          },
  { type: 'rack',           label: 'Rack Unit'       },
  { type: 'monitor_wedge',  label: 'Monitor Wedge'   },
  { type: 'custom',         label: 'Custom'          },
]
