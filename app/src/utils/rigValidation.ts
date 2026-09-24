/**
 * rigValidation.ts
 *
 * The client-side half of the rig contract.
 *
 * `App\Http\Requests\Concerns\ValidatesRig` is the authority — it has to be,
 * since a frontend bug must not be able to persist a malformed rig. But every
 * rule there is satisfied by the defaults in @/types/rig except one:
 * `inputs.*.instrument` is required, and `defaultInputRow()` starts empty
 * because only the user can name a channel.
 *
 * So "Add row" creates a row the server will reject, and the rejection arrives
 * as a 422 on a save the user thought was unrelated. This module names that
 * gap in one place, so the editors can refuse the save with a message that
 * says which channel rather than letting the round-trip fail.
 *
 * Pure functions only — no Vue, no fetching.
 */

import type { InputRow } from '@bandms/rider-core'

/** One place channels are edited: a musician's rig, or the rider's extras. */
export interface ChannelGroup {
  /** Where these channels live, in the user's words — "Marek", "Extra channels". */
  label: string
  inputs: InputRow[] | undefined
}

/** 1-based positions of the channels in `inputs` that carry no instrument name. */
export function unnamedChannels(inputs: InputRow[] | undefined): number[] {
  return (inputs ?? []).reduce<number[]>((out, row, i) => {
    if (row.instrument.trim() === '') out.push(i + 1)
    return out
  }, [])
}

export function hasUnnamedChannels(inputs: InputRow[] | undefined): boolean {
  return unnamedChannels(inputs).length > 0
}

/**
 * Why this rig cannot be saved yet, or null when it can.
 *
 * Returns a catalogue key and its params rather than a sentence. This module
 * is deliberately pure — no Vue — so it cannot call useI18n(), and the
 * previous version returned English that went straight into a toast. That
 * English survived the i18n sweep invisibly: the toast argument is a variable,
 * so the string lint's script scan never sees a literal, and a types/utils
 * file is not walked by the coverage guard either.
 *
 * Phrased as an instruction rather than a validation code: the user is looking
 * at the row in question, and "row 3 of Extra channels needs an instrument
 * name" tells them what to do next. "The given data was invalid" does not.
 */
export type RigProblem =
  | { key: 'band.setups.unnamedOne'; params: { row: number; label: string } }
  | { key: 'band.setups.unnamedMany'; params: { total: number; where: string } }

export function unnamedChannelProblem(groups: ChannelGroup[]): RigProblem | null {
  const offenders = groups
    .map((group) => ({ label: group.label, rows: unnamedChannels(group.inputs) }))
    .filter((group) => group.rows.length > 0)

  if (!offenders.length) return null

  const total = offenders.reduce((sum, group) => sum + group.rows.length, 0)

  // One offender is the overwhelmingly common case, and naming the row beats
  // any amount of counting.
  if (total === 1) {
    const [only] = offenders
    return { key: 'band.setups.unnamedOne', params: { row: only.rows[0], label: only.label } }
  }

  const where = offenders.map((group) => `${group.label} (${group.rows.join(', ')})`).join('; ')

  return { key: 'band.setups.unnamedMany', params: { total, where } }
}
