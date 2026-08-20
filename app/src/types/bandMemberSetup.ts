/**
 * A band member's saved rig — the reusable library a rider draws from.
 *
 * A setup is a RigSpec plus identity. All the technical shapes live in
 * @/types/rig; this file must not redeclare any of them.
 */

import type { RigSpec, SignalChainType } from './rig'

export interface BandMemberSetup extends RigSpec {
  id: number
  band_member_id: number
  instrument_id: number | null
  shared_monitor_id: number | null
  name: string
  is_default: boolean
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
  monitor_count: number
  updated_at: string
}

export type BandMemberSetupPayload = Partial<RigSpec> & {
  name?: string
  is_default?: boolean
  instrument_id?: number | null
  shared_monitor_id?: number | null
}

/** All setups for one member, as returned by the all-setups endpoint. */
export interface MemberSetupGroup {
  member_id: number
  member_name: string
  member_role: string | null
  setups: BandMemberSetup[]
}

/** id → setup, for resolving placement references. */
export type SetupLookup = Record<number, BandMemberSetup>

export function setupLookupFromGroups(groups: MemberSetupGroup[]): SetupLookup {
  const out: SetupLookup = {}
  for (const group of groups) {
    for (const setup of group.setups) out[setup.id] = setup
  }
  return out
}
