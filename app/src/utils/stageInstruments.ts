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

import type { BandMember } from '@/types/bandMember'
import type { StagePlotMemberItem } from '@/types/stagePlot'
import { INSTRUMENT_TYPE_LABELS } from '@/types/stagePlot'
import type { StagePlotItemType } from '@/types/techRider'
import { guessInstrumentType } from '@/utils/instrumentIcons'

export interface DisplayInstrument {
  id: string
  type: StagePlotItemType
  label: string
  /** true when it comes from the member's profile, not from this stage position */
  inferred: boolean
}

/** Icon type for a member's main instrument, guessing from its name if unmapped. */
export function memberMainInstrumentType(member: BandMember): StagePlotItemType | null {
  const inst = member.main_instrument
  if (!inst) return null
  return inst.stage_plot_type ?? guessInstrumentType(inst.name)
}

export function resolveStageInstruments(
  item: StagePlotMemberItem,
  members: BandMember[],
): DisplayInstrument[] {
  // stage_plot_data is an unvalidated JSON column and older rows predate the
  // instruments array, so never assume it is present.
  if (item.instruments?.length) {
    return item.instruments.map(i => ({
      id:       i.id,
      type:     i.type,
      label:    i.label || INSTRUMENT_TYPE_LABELS[i.type],
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
    label:    member.main_instrument?.name ?? member.role ?? INSTRUMENT_TYPE_LABELS[type],
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
  item: StagePlotMemberItem,
  members: BandMember[],
): InstrumentBadge[] {
  const list = resolveStageInstruments(item, members).slice(0, 3)
  const offsets = BADGE_OFFSETS[list.length] ?? []
  return list.map((inst, i) => ({ ...inst, dx: offsets[i][0], dy: offsets[i][1] }))
}
