/**
 * Builders for the rider unit tests.
 *
 * Every builder takes a partial and fills the rest, so a test names only the
 * field it is about. A test that says `input({ mic_di: 'DI' })` is legible in a
 * way that a twelve-key object literal is not, and the noise it hides is
 * exactly the noise that makes these tests rot.
 */

import type { RiderMember } from '@/types/bandMember'
import type { BandMemberSetup, SetupLookup } from '@/types/bandMemberSetup'
import type {
  BacklineSpec,
  InputRow,
  MonitorSpec,
  RigSpec,
  WirelessSpec,
} from '@/types/rig'
import { defaultRigSpec } from '@/types/rig'
import type { StagePlacement } from '@/types/stagePlot'
import type { ResolvableRider } from '@/utils/riderResolver'
import type { PublishedRider } from '@/types/techRiderVersion'

export function input(over: Partial<InputRow> = {}): InputRow {
  return {
    id: 'in-1',
    instrument: 'Kick',
    mic_di: 'Mic',
    mic_model: 'D112',
    stand_type: 'Short boom',
    notes: '',
    ...over,
  }
}

export function monitor(over: Partial<MonitorSpec> = {}): MonitorSpec {
  return {
    id: 'mon-1',
    label: 'Wedge',
    type: 'wedge',
    config: 'mono',
    mix_description: 'Vocals + kick',
    iem_own_pack: false,
    iem_transmitter_model: '',
    iem_frequency: '',
    ...over,
  }
}

export function backline(over: Partial<BacklineSpec> = {}): BacklineSpec {
  return {
    id: 'bl-1',
    needed: true,
    category: 'drum_kit',
    name: 'Kit',
    brand_preference: 'Yamaha',
    specs: '',
    notes: '',
    ...over,
  }
}

export function wireless(over: Partial<WirelessSpec> = {}): WirelessSpec {
  return {
    id: 'rf-1',
    type: 'instrument',
    brand_model: 'GLXD16',
    frequency_band: 'Z2',
    own_unit: true,
    notes: '',
    ...over,
  }
}

export function rig(over: Partial<RigSpec> = {}): RigSpec {
  return { ...defaultRigSpec(), ...over }
}

export function setup(id: number, over: Partial<BandMemberSetup> = {}): BandMemberSetup {
  return {
    ...defaultRigSpec(),
    id,
    band_member_id: 1,
    instrument_id: null,
    shared_monitor_id: null,
    name: `Setup ${id}`,
    is_default: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

export function lookup(...setups: BandMemberSetup[]): SetupLookup {
  return Object.fromEntries(setups.map((s) => [s.id, s]))
}

export function placement(over: Partial<StagePlacement> = {}): StagePlacement {
  return {
    id: 'pos-1',
    band_member_id: 1,
    setup_id: null,
    x: 50,
    y: 50,
    instruments: [],
    overrides: {},
    ...over,
  }
}

export function member(over: Partial<RiderMember> = {}): RiderMember {
  return {
    id: 1,
    first_name: 'Marek',
    last_name: 'Kowalski',
    nickname: null,
    role: 'Drums',
    photo: null,
    is_current: true,
    main_instrument_id: null,
    main_instrument: null,
    instruments: [],
    ...over,
  }
}

export function rider(over: Partial<ResolvableRider> = {}): ResolvableRider {
  return {
    placements: [],
    gig_lineup: { temp_musicians: [] },
    extra_inputs: [],
    extra_monitors: [],
    extra_backline: [],
    extra_wireless: [],
    channel_order: [],
    power_notes: { total_wattage: null, needs_clean_power: false, general_notes: '' },
    ...over,
  }
}

/** A published snapshot wrapping a resolvable rider, for diff tests. */
export function snapshot(
  versionNumber: number,
  resolvable: ResolvableRider,
  setups: BandMemberSetup[] = [],
  members: RiderMember[] = [member()],
): PublishedRider {
  return {
    format: 1,
    taken_at: '2026-08-19T00:00:00Z',
    members,
    profile: { name: 'Skanking Storks', logo_url: null },
    version: {
      id: versionNumber,
      tech_rider_id: 1,
      version_number: versionNumber,
      notes: null,
      status: 'published',
      public_token: 'x'.repeat(32),
      published_at: '2026-08-19T00:00:00Z',
      created_at: '2026-08-19T00:00:00Z',
    },
    rider: {
      id: 1,
      profile_id: 1,
      name: 'Club show',
      is_active: true,
      public_token: 'y'.repeat(32),
      concert_id: null,
      gig_lineup: { regular_members: [], temp_musicians: resolvable.gig_lineup.temp_musicians },
      placements: resolvable.placements,
      referenced_setups: Object.fromEntries(setups.map((s) => [String(s.id), s])),
      extra_inputs: resolvable.extra_inputs,
      extra_monitors: resolvable.extra_monitors,
      extra_backline: resolvable.extra_backline,
      extra_wireless: resolvable.extra_wireless,
      channel_order: resolvable.channel_order,
      power_notes: resolvable.power_notes,
      pa_foh: {
        room_coverage_notes: '', subwoofer_notes: '', processing_notes: '',
        console_preference: '', brings_own_foh_engineer: false, foh_engineer_name: '',
        brings_show_file: false, show_file_format: '',
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  }
}
