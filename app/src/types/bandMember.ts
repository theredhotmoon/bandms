import type { SocialLink, SocialLinkPayload } from './socialLink'
import type { Instrument } from './instrument'
import type { StagePlotItemType } from './techRider'

// ── Default gear ──────────────────────────────────────────────────────────────

export type DefaultGearItemType =
  | 'microphone'
  | 'amp_head'
  | 'amp_combo'
  | 'cabinet'
  | 'di_box'
  | 'keyboard'
  | 'drum_kit'
  | 'drum_hardware'
  | 'pedal_board'
  | 'wireless_system'
  | 'other'

export interface DefaultGearItem {
  id: string
  type: DefaultGearItemType
  label: string
  brand_model: string
  own_gear: boolean
  notes: string
}

export const DEFAULT_GEAR_TYPE_LABELS: Record<DefaultGearItemType, string> = {
  microphone:      'Microphone',
  amp_head:        'Amp Head',
  amp_combo:       'Combo Amp',
  cabinet:         'Cabinet',
  di_box:          'DI Box',
  keyboard:        'Keyboard / Synth',
  drum_kit:        'Drum Kit',
  drum_hardware:   'Drum Hardware',
  pedal_board:     'Pedal Board',
  wireless_system: 'Wireless System',
  other:           'Other',
}

// ── Band member ───────────────────────────────────────────────────────────────

export interface BandMember {
  id: number
  band_id: number
  first_name: string
  nickname: string | null
  last_name: string
  bio: string | null
  photo: string | null
  role: string | null
  is_current: boolean
  joined_at: string | null
  quit_at: string | null
  sort_order: number
  calendar_url: string | null
  login_email: string | null
  can_login: boolean
  default_gear: DefaultGearItem[]
  instruments: Instrument[]
  main_instrument_id: number | null
  main_instrument: (Instrument & { stage_plot_type: StagePlotItemType | null }) | null
  social_links: SocialLink[]
  created_at: string
  updated_at: string
}

/**
 * The only member fields a rider needs: enough to name a musician, draw them on
 * the stage plot, and guess their instrument when the placement does not say.
 *
 * Published rider snapshots carry exactly this and no more — a snapshot is a
 * public document, so it must not be typed as a full `BandMember`, which
 * includes `login_email` and `can_login`. See App\Services\TechRiderSnapshotBuilder.
 *
 * A full `BandMember` satisfies it structurally, so the live admin surfaces
 * keep passing their own data unchanged.
 */
export type RiderMember = Pick<
  BandMember,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'nickname'
  | 'role'
  | 'photo'
  | 'is_current'
  | 'main_instrument_id'
  | 'main_instrument'
  | 'instruments'
>

export interface BandMemberPayload {
  first_name: string
  nickname?: string | null
  last_name: string
  bio?: string | null
  photo?: string | null
  photo_file?: File | null   // handled by view before API call; not sent as JSON
  role?: string | null
  is_current?: boolean
  joined_at?: string | null
  quit_at?: string | null
  sort_order?: number
  calendar_url?: string | null
  login_email?: string | null
  can_login?: boolean
  instrument_ids?: number[]
  main_instrument_id?: number | null
  social_links?: SocialLinkPayload[]
  default_gear?: DefaultGearItem[]
}
