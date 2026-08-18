/**
 * riderResolver.ts
 *
 * Turns a rider's placements into the lists that get printed: channels,
 * monitors, backline, power positions, RF units.
 *
 * This is the *only* place that derivation happens. The admin editor, the
 * preview and the public token view all call `resolveRider`, so what the
 * engineer sees while editing is by construction the same as what the venue
 * receives. There is no "build" step and nothing to keep in sync by hand.
 *
 * Pure functions only — no Vue, no fetching, no side effects.
 */

import type { BandMember } from '@/types/bandMember'
import type { SetupLookup } from '@/types/bandMemberSetup'
import type {
  BacklineSpec,
  InputRow,
  MonitorSpec,
  PowerSpec,
  RigField,
  RigSpec,
  WirelessSpec,
} from '@/types/rig'
import { defaultRigSpec, RIG_FIELDS } from '@/types/rig'
import type { GigTempMusician, StagePlacement } from '@/types/stagePlot'
import { resolveStageInstruments } from './stageInstruments'

// ── Where a resolved row came from ────────────────────────────────────────────

export interface RigSource {
  kind: 'member' | 'guest' | 'extra'
  /** null for production extras, which belong to no placement. */
  placementId: string | null
  /** "Marek" / "Tomek (guest)" / "Production" */
  name: string
  /** The saved rig's name, or the instruments played, for a second line. */
  detail: string
  /** true when this placement patches the field the row came from. */
  overridden: boolean
}

export interface ResolvedInput extends InputRow {
  key: string
  channel: number
  source: RigSource
}

export interface ResolvedMonitor extends MonitorSpec {
  key: string
  source: RigSource
}

export interface ResolvedBackline extends BacklineSpec {
  key: string
  source: RigSource
}

export interface ResolvedPowerPosition {
  key: string
  location: string
  outlets_needed: number
  notes: string
  source: RigSource
}

export interface ResolvedWireless extends WirelessSpec {
  key: string
  source: RigSource
}

export interface ResolvedPower {
  positions: ResolvedPowerPosition[]
  total_outlets: number
  total_wattage: number | null
  needs_clean_power: boolean
  general_notes: string
}

export interface ResolvedRider {
  inputs: ResolvedInput[]
  monitors: ResolvedMonitor[]
  backline: ResolvedBackline[]
  power: ResolvedPower
  wireless: ResolvedWireless[]
}

/** The minimum a resolver caller has to supply — the editor passes its draft. */
export interface ResolvableRider {
  placements: StagePlacement[]
  gig_lineup: { temp_musicians: GigTempMusician[] }
  extra_inputs: InputRow[]
  extra_monitors: MonitorSpec[]
  extra_backline: BacklineSpec[]
  extra_wireless: WirelessSpec[]
  channel_order: string[]
  power_notes: { total_wattage: number | null; needs_clean_power: boolean; general_notes: string }
}

// ── Resolving one placement ───────────────────────────────────────────────────

/**
 * The saved rig a placement points at, patched with its per-gig overrides.
 * A placement with no `setup_id` (a guest, or a one-off position) resolves
 * against an empty rig, so its overrides simply *are* its rig.
 */
export function resolveRig(placement: StagePlacement, setups: SetupLookup): RigSpec {
  const base = placement.setup_id != null ? setups[placement.setup_id] : undefined
  const rig = defaultRigSpec()

  for (const field of RIG_FIELDS) {
    const overridden = placement.overrides?.[field]
    if (overridden !== undefined) {
      assignField(rig, field, overridden)
    } else if (base) {
      assignField(rig, field, base[field])
    }
  }

  return rig
}

/** Narrow per-field copy — keeps `rig` correctly typed without an `any` cast. */
function assignField(rig: RigSpec, field: RigField, value: unknown): void {
  switch (field) {
    case 'signal_chain_type':
      rig.signal_chain_type = value as RigSpec['signal_chain_type']
      break
    case 'inputs':
      rig.inputs = (value as InputRow[]) ?? []
      break
    case 'monitors':
      rig.monitors = (value as MonitorSpec[]) ?? []
      break
    case 'backline':
      rig.backline = (value as BacklineSpec[]) ?? []
      break
    case 'power':
      rig.power = (value as PowerSpec) ?? rig.power
      break
    case 'wireless':
      rig.wireless = (value as WirelessSpec[]) ?? []
      break
    case 'foh_notes':
      rig.foh_notes = (value as string) ?? ''
      break
  }
}

export function isOverridden(placement: StagePlacement, field: RigField): boolean {
  return placement.overrides?.[field] !== undefined
}

/** Which rig fields this placement changes for this gig. */
export function overriddenFields(placement: StagePlacement): RigField[] {
  return RIG_FIELDS.filter((f) => isOverridden(placement, f))
}

// ── Naming a placement ────────────────────────────────────────────────────────

export function placementName(
  placement: StagePlacement,
  members: BandMember[],
  temps: GigTempMusician[],
): string {
  if (placement.temp_id) {
    const temp = temps.find((t) => t.id === placement.temp_id)
    return temp ? `${temp.name} (guest)` : 'Guest'
  }
  const member = members.find((m) => m.id === placement.band_member_id)
  if (!member) return `Member #${placement.band_member_id ?? '?'}`
  return member.nickname ?? `${member.first_name} ${member.last_name}`
}

function placementDetail(
  placement: StagePlacement,
  members: BandMember[],
  setups: SetupLookup,
): string {
  const setup = placement.setup_id != null ? setups[placement.setup_id] : undefined
  if (setup) return setup.name

  const instruments = resolveStageInstruments(placement, members)
  if (instruments.length) return instruments.map((i) => i.label).join(' + ')

  return 'No saved rig'
}

function sourceFor(
  placement: StagePlacement,
  field: RigField,
  members: BandMember[],
  temps: GigTempMusician[],
  setups: SetupLookup,
): RigSource {
  return {
    kind: placement.temp_id ? 'guest' : 'member',
    placementId: placement.id,
    name: placementName(placement, members, temps),
    detail: placementDetail(placement, members, setups),
    overridden: isOverridden(placement, field),
  }
}

const EXTRA_SOURCE: RigSource = {
  kind: 'extra',
  placementId: null,
  name: 'Production',
  detail: 'Added on the rider',
  overridden: false,
}

/** Stable key for a resolved row — survives reordering and re-resolution. */
function rowKey(placementId: string | null, rowId: string): string {
  return `${placementId ?? 'extra'}:${rowId}`
}

// ── Resolving the whole rider ─────────────────────────────────────────────────

export function resolveRider(
  rider: ResolvableRider,
  setups: SetupLookup,
  members: BandMember[],
): ResolvedRider {
  const temps = rider.gig_lineup?.temp_musicians ?? []
  const placements = rider.placements ?? []

  const inputs: ResolvedInput[] = []
  const monitors: ResolvedMonitor[] = []
  const backline: ResolvedBackline[] = []
  const positions: ResolvedPowerPosition[] = []
  const wireless: ResolvedWireless[] = []

  for (const placement of placements) {
    const rig = resolveRig(placement, setups)
    const src = (field: RigField) => sourceFor(placement, field, members, temps, setups)

    for (const row of rig.inputs) {
      inputs.push({ ...row, key: rowKey(placement.id, row.id), channel: 0, source: src('inputs') })
    }

    for (const mon of rig.monitors) {
      monitors.push({ ...mon, key: rowKey(placement.id, mon.id), source: src('monitors') })
    }

    // Only backline the promoter has to supply belongs on the rider; gear the
    // musician brings is recorded on the rig but not requested from the venue.
    for (const item of rig.backline) {
      if (!item.needed) continue
      backline.push({ ...item, key: rowKey(placement.id, item.id), source: src('backline') })
    }

    if (rig.power.outlets_needed > 0) {
      const source = src('power')
      positions.push({
        key: rowKey(placement.id, 'power'),
        location: source.name,
        outlets_needed: rig.power.outlets_needed,
        notes: rig.power.notes,
        source,
      })
    }

    for (const unit of rig.wireless) {
      wireless.push({ ...unit, key: rowKey(placement.id, unit.id), source: src('wireless') })
    }
  }

  // ── Production extras ───────────────────────────────────────────────────────

  for (const row of rider.extra_inputs ?? []) {
    inputs.push({ ...row, key: rowKey(null, row.id), channel: 0, source: EXTRA_SOURCE })
  }
  for (const mon of rider.extra_monitors ?? []) {
    monitors.push({ ...mon, key: rowKey(null, mon.id), source: EXTRA_SOURCE })
  }
  for (const item of rider.extra_backline ?? []) {
    backline.push({ ...item, key: rowKey(null, item.id), source: EXTRA_SOURCE })
  }
  for (const unit of rider.extra_wireless ?? []) {
    wireless.push({ ...unit, key: rowKey(null, unit.id), source: EXTRA_SOURCE })
  }

  const ordered = applyChannelOrder(inputs, rider.channel_order ?? [])
  ordered.forEach((row, i) => { row.channel = i + 1 })

  const notes = rider.power_notes ?? { total_wattage: null, needs_clean_power: false, general_notes: '' }

  return {
    inputs: ordered,
    monitors,
    backline,
    power: {
      positions,
      total_outlets: positions.reduce((sum, p) => sum + p.outlets_needed, 0),
      total_wattage: notes.total_wattage,
      needs_clean_power: notes.needs_clean_power,
      general_notes: notes.general_notes,
    },
    wireless,
  }
}

/**
 * Applies the engineer's saved channel order.
 *
 * Deliberately forgiving: keys that no longer resolve are skipped and rows the
 * order does not mention are appended in placement order. That way the stored
 * order never has to be migrated when a musician or a channel is added.
 */
export function applyChannelOrder(rows: ResolvedInput[], order: string[]): ResolvedInput[] {
  if (!order.length) return rows

  const byKey = new Map(rows.map((r) => [r.key, r]))
  const out: ResolvedInput[] = []

  for (const key of order) {
    const row = byKey.get(key)
    if (row) {
      out.push(row)
      byKey.delete(key)
    }
  }
  for (const row of rows) {
    if (byKey.has(row.key)) out.push(row)
  }

  return out
}

// ── Completeness ──────────────────────────────────────────────────────────────

export interface PlacementStatus {
  placementId: string
  name: string
  complete: boolean
  missing: string[]
}

/** A placement is complete when the engineer can actually patch it in. */
export function placementStatus(
  placement: StagePlacement,
  setups: SetupLookup,
  members: BandMember[],
  temps: GigTempMusician[],
): PlacementStatus {
  const rig = resolveRig(placement, setups)
  const missing: string[] = []

  if (!resolveStageInstruments(placement, members).length) missing.push('instrument')
  if (!rig.inputs.length) missing.push('inputs')
  if (!rig.monitors.length) missing.push('monitor')

  return {
    placementId: placement.id,
    name: placementName(placement, members, temps),
    complete: missing.length === 0,
    missing,
  }
}

export interface RiderCompleteness {
  total: number
  complete: number
  partial: number
  pct: number
  statuses: PlacementStatus[]
}

export function riderCompleteness(
  rider: ResolvableRider,
  setups: SetupLookup,
  members: BandMember[],
): RiderCompleteness {
  const temps = rider.gig_lineup?.temp_musicians ?? []
  const statuses = (rider.placements ?? []).map((p) => placementStatus(p, setups, members, temps))

  const complete = statuses.filter((s) => s.complete).length
  const partial = statuses.filter((s) => !s.complete && s.missing.length < 3).length

  return {
    total: statuses.length,
    complete,
    partial,
    pct: statuses.length ? Math.round((complete / statuses.length) * 100) : 0,
    statuses,
  }
}
