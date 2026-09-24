/**
 * stageInstruments.ts
 *
 * Single source of truth for "what instruments does this stage position show?",
 * shared by the stage-plot editor, the tech rider preview and the public rider.
 *
 * A musician placed on stage before any instrument was attached would otherwise
 * render nothing at all. We fall back to their profile — main instrument first,
 * then a guess from their role text — and flag it as `inferred` so each surface
 * can mark it as assumed rather than configured.
 */

import type { RiderMember } from './types/bandMember'
import type { StagePlacement } from './types/stagePlot'
import type { StagePlotItemType } from './types/instrumentType'
import type { InstrumentLabels } from './labels/types'
import { EN_INSTRUMENT_LABELS } from './labels/en'
import { guessInstrumentType } from './instrumentIcons'

export interface DisplayInstrument {
  id: string
  type: StagePlotItemType
  label: string
  /** true when it comes from the member's profile, not from this stage position */
  inferred: boolean
}

/** Icon type for a member's main instrument, guessing from its name if unmapped. */
export function memberMainInstrumentType(member: RiderMember): StagePlotItemType | null {
  const inst = member.main_instrument
  if (!inst) return null
  return inst.stage_plot_type ?? guessInstrumentType(inst.name)
}

/**
 * `labels` is optional and defaults to English so the resolver keeps working
 * for callers that render no instrument names of their own — the completeness
 * check, the version diff, the fixtures. Every surface that *prints* a name
 * passes its own map. A band member's typed-in instrument name is never
 * translated; only the fallback to the catalogue's generic label is.
 */
export function resolveStageInstruments(
  item: StagePlacement,
  members: RiderMember[],
  labels: InstrumentLabels = EN_INSTRUMENT_LABELS,
): DisplayInstrument[] {
  if (item.instruments?.length) {
    return item.instruments.map(i => ({
      id:       i.id,
      type:     i.type,
      // `|| i.type` is the floor: a published snapshot can hold an
      // instrument type added after it was frozen, and a blank cell in a
      // patch list is worse than a raw key an engineer can still read.
      label:    i.label || labels[i.type] || i.type,
      inferred: false,
    }))
  }

  const member = members.find(m => m.id === item.band_member_id)
  if (!member) return []

  const type = memberMainInstrumentType(member) ?? guessInstrumentType(member.role ?? '')
  if (!type) return []

  return [{
    id:       `${item.id}-inferred`,
    type,
    label:    member.main_instrument?.name ?? member.role ?? labels[type],
    inferred: true,
  }]
}

// ── Rider diagram badge layout ────────────────────────────────────────────────

/** Radius of the circle behind each instrument badge on the rider diagrams. */
export const BADGE_R = 14

// Offsets from the musician's circle, by badge count. Kept at least 2*BADGE_R
// apart so badges never overlap each other.
const BADGE_OFFSETS: [number, number][][] = [
  [],
  [[-25, -22]],
  [[-25, -25], [-25, 25]],
  [[-25, -27], [-40, 0], [-25, 27]],
]

export interface InstrumentBadge extends DisplayInstrument {
  dx: number
  dy: number
}

/** Positioned instrument badges for one musician (max 3). */
export function instrumentBadgesFor(
  item: StagePlacement,
  members: RiderMember[],
  labels: InstrumentLabels = EN_INSTRUMENT_LABELS,
): InstrumentBadge[] {
  const list = resolveStageInstruments(item, members, labels).slice(0, 3)
  const offsets = BADGE_OFFSETS[list.length] ?? []
  return list.map((inst, i) => ({ ...inst, dx: offsets[i][0], dy: offsets[i][1] }))
}
