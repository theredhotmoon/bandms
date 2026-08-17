import type { StagePlotItemType, InputRow } from './techRider'
import type {
  SignalChainType,
  MemberMonitorPrefs,
  MemberBacklinePrefs,
  MemberPowerPrefs,
  WirelessUnit,
  MonitorConfig,
} from './bandMemberSetup'
import { defaultBacklinePrefs, defaultPowerPrefs, defaultMonitorPrefs } from './bandMemberSetup'
import { INSTRUMENT_ICON_CATALOG } from '@/utils/instrumentIcons'

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
  band_member_id: number | null
  temp_id?: string
  x: number
  y: number
  // Visual instrument slots (type + label for stage display)
  instruments: PlacedInstrument[]
  // Technical setup at member level (shared across all instruments)
  signal_chain_type: SignalChainType
  inputs: InputRow[]
  monitors: PlacedMonitor[]        // supports multiple wedges / IEM units
  backline: MemberBacklinePrefs
  power: MemberPowerPrefs
  wireless: WirelessUnit[]
  foh_notes: string
}

// Instrument slot — visual only (type icon + label on stage canvas)
export interface PlacedInstrument {
  id: string
  type: StagePlotItemType
  label: string
  setup_id: number | null  // link to a saved BandMemberSetup for quick-import
}

// One monitor unit. Field names align with MemberMonitorPrefs for easy conversion.
export interface PlacedMonitor {
  id: string
  label: string                   // display name, e.g. "Stage left wedge"
  type: 'wedge' | 'iem'
  config: MonitorConfig           // 'mono' | 'stereo'
  mix_description: string
  iem_own_pack: boolean
  iem_transmitter_model: string
  iem_frequency: string
}

// ── Conversion helpers ────────────────────────────────────────────────────────

export function monitorToPrefs(mon: PlacedMonitor): MemberMonitorPrefs {
  return {
    type:               mon.type,
    config:             mon.config,
    mix_description:    mon.mix_description,
    iem_own_pack:       mon.iem_own_pack,
    iem_transmitter_model: mon.iem_transmitter_model,
    iem_frequency:      mon.iem_frequency,
  }
}

export function prefsToMonitor(prefs: MemberMonitorPrefs, id: string, label: string): PlacedMonitor {
  return {
    id,
    label,
    type:               prefs.type,
    config:             prefs.config,
    mix_description:    prefs.mix_description,
    iem_own_pack:       prefs.iem_own_pack,
    iem_transmitter_model: prefs.iem_transmitter_model,
    iem_frequency:      prefs.iem_frequency,
  }
}

// ── Default factories ─────────────────────────────────────────────────────────

export function defaultGigLineup(): GigLineup {
  return { regular_members: [], temp_musicians: [] }
}

export function defaultPlacedInstrument(): PlacedInstrument {
  return {
    id:       uid('inst'),
    type:     'vocalist',
    label:    '',
    setup_id: null,
  }
}

export function defaultPlacedMonitor(): PlacedMonitor {
  const prefs = defaultMonitorPrefs()
  return {
    id:                   uid('mon'),
    label:                'Stage Monitor',
    type:                 prefs.type,
    config:               prefs.config,
    mix_description:      prefs.mix_description,
    iem_own_pack:         prefs.iem_own_pack,
    iem_transmitter_model:prefs.iem_transmitter_model,
    iem_frequency:        prefs.iem_frequency,
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
    instruments:       [],
    signal_chain_type: 'other',
    inputs:            [],
    monitors:          [],
    backline:          defaultBacklinePrefs(),
    power:             defaultPowerPrefs(),
    wireless:          [],
    foh_notes:         '',
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Completeness helpers ──────────────────────────────────────────────────────

export function isMemberItemComplete(item: StagePlotMemberItem): boolean {
  return (item.instruments?.length ?? 0) > 0 && (item.inputs?.length ?? 0) > 0 && (item.monitors?.length ?? 0) > 0
}

export function isMemberItemPartial(item: StagePlotMemberItem): boolean {
  return !isMemberItemComplete(item) && (
    (item.instruments?.length ?? 0) > 0 || (item.inputs?.length ?? 0) > 0 || (item.monitors?.length ?? 0) > 0
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
// Labels and ordering come from the icon catalogue so a new icon only has to be
// declared in one place.

export const INSTRUMENT_TYPE_LABELS = Object.fromEntries(
  INSTRUMENT_ICON_CATALOG.map(def => [def.type, def.label]),
) as Record<StagePlotItemType, string>

export const INSTRUMENT_PALETTE: { type: StagePlotItemType; label: string }[] =
  INSTRUMENT_ICON_CATALOG.map(def => ({ type: def.type, label: def.label }))
