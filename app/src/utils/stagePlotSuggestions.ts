/**
 * stagePlotSuggestions.ts
 *
 * Pure functions that derive tech-rider list data from a stage plot.
 * Includes both legacy StagePlotItem[] functions and new member-centric
 * StagePlotMemberItem[] functions.
 */

import type {
  StagePlotItem,
  StagePlotItemType,
  InputRow,
  MicDiChoice,
  MonitorMix,
  MonitorType,
  BacklineItem,
  BacklineCategory,
  PowerPosition,
} from '@/types/techRider'
import type { StagePlotMemberItem } from '@/types/stagePlot'

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type RawRow = Omit<InputRow, 'id' | 'channel'>

function row(
  instrument: string,
  mic_di: MicDiChoice,
  mic_model: string,
  stand_type: string,
  notes = '',
): RawRow {
  return { instrument, mic_di, mic_model, stand_type, notes }
}

// ── Inputs List ───────────────────────────────────────────────────────────────

/**
 * Returns a numbered InputRow[] derived from the placed stage-plot items.
 * Channel numbers are assigned sequentially in plot order.
 * monitor_wedge items are skipped (they are outputs, not inputs).
 */
export function suggestInputs(items: StagePlotItem[]): InputRow[] {
  const raw: RawRow[] = []

  for (const item of items) {
    const lbl = item.label

    switch (item.type) {
      case 'drums':
        raw.push(
          row(`${lbl} — Kick (in)`,   'Mic', 'AKG D112 / Beta 52A', 'Short boom'),
          row(`${lbl} — Kick (out)`,  'Mic', 'SM91 / Beta 91A',      'None',      'Boundary / inner'),
          row(`${lbl} — Snare (top)`, 'Mic', 'SM57',                 'Low tom'),
          row(`${lbl} — Snare (btm)`, 'Mic', 'SM57',                 'Low tom',   'Phase flip'),
          row(`${lbl} — Hi-Hat`,      'Mic', 'SM81 / C451B',         'Short boom'),
          row(`${lbl} — Tom 1`,       'Mic', 'e604 / MD421',         'Low tom'),
          row(`${lbl} — Tom 2`,       'Mic', 'e604 / MD421',         'Low tom'),
          row(`${lbl} — Floor Tom`,   'Mic', 'e604 / MD421',         'Low tom'),
          row(`${lbl} — Overhead L`,  'Mic', 'SM81 / AKG C414',      'Tall boom'),
          row(`${lbl} — Overhead R`,  'Mic', 'SM81 / AKG C414',      'Tall boom'),
        )
        break

      case 'guitar_amp':
        raw.push(
          row(lbl, 'Mic', 'SM57', 'Short boom'),
        )
        break

      case 'bass_amp':
        raw.push(
          row(`${lbl} (mic)`, 'Mic', 'AKG D112 / Beta 52A', 'Short boom'),
          row(`${lbl} (DI)`,  'DI',  '',                    'None',       'Pre-amp out preferred'),
        )
        break

      case 'keyboard':
        raw.push(
          row(`${lbl} — L`, 'DI', '', 'Desk'),
          row(`${lbl} — R`, 'DI', '', 'Desk', 'Stereo pair'),
        )
        break

      case 'vocalist':
        raw.push(
          row(lbl, 'Mic', 'SM58 / e945', 'Tall boom'),
        )
        break

      case 'acoustic_guitar':
        raw.push(
          row(lbl, 'Mic+DI', 'DPA 4099 / AKG C414', 'Tall boom'),
        )
        break

      case 'violin':
        raw.push(
          row(lbl, 'Mic', 'DPA 4099', 'Tall boom', 'Clip-on preferred'),
        )
        break

      case 'brass':
        raw.push(
          row(lbl, 'Mic', 'SM57 / Beta 98A', 'Short boom'),
        )
        break

      case 'di_box':
        raw.push(
          row(lbl, 'DI', '', 'None'),
        )
        break

      case 'rack':
        raw.push(
          row(`${lbl} — Output`, 'DI', '', 'None'),
        )
        break

      case 'custom':
        raw.push(
          row(lbl, 'Mic', '', 'Tall boom'),
        )
        break

      case 'monitor_wedge':
        // Wedges are outputs — handled in suggestMonitors, not inputs.
        break
    }
  }

  return raw.map((r, i) => ({ ...r, id: uid('row'), channel: i + 1 }))
}

// ── Monitor / IEM mixes ───────────────────────────────────────────────────────

/**
 * Returns one MonitorMix (wedge) per monitor_wedge item on the stage plot.
 */
export function suggestMonitors(items: StagePlotItem[]): MonitorMix[] {
  return items
    .filter((i) => i.type === 'monitor_wedge')
    .map((item) => ({
      id: uid('mon'),
      band_member_id: null,
      custom_name: item.label || 'Monitor wedge',
      type: 'wedge' as MonitorType,
      mix_description: '',
      iem_own_pack: false,
      transmitter_model: '',
      frequency: '',
    }))
}

// ── Backline ──────────────────────────────────────────────────────────────────

const BACKLINE_MAP: Partial<Record<StagePlotItemType, BacklineCategory>> = {
  drums:      'drum_kit',
  guitar_amp: 'guitar_amp',
  bass_amp:   'bass_amp',
  keyboard:   'keyboard',
}

/**
 * Returns one BacklineItem per backline-eligible stage-plot item
 * (drums, guitar amp, bass amp, keyboard).
 */
export function suggestBackline(items: StagePlotItem[]): BacklineItem[] {
  return items
    .filter((i): i is StagePlotItem & { type: keyof typeof BACKLINE_MAP } =>
      i.type in BACKLINE_MAP,
    )
    .map((item) => ({
      id: uid('bl'),
      category: BACKLINE_MAP[item.type]!,
      name: item.label,
      brand_preference: '',
      specs: '',
      notes: '',
    }))
}

// ── Power positions ───────────────────────────────────────────────────────────

const POWER_OUTLETS: Partial<Record<StagePlotItemType, number>> = {
  drums:      4,  // sub-kick, trigger, drum light, metronome
  guitar_amp: 2,
  bass_amp:   2,
  keyboard:   4,  // multiple units likely
  rack:       4,
}

/**
 * Returns one PowerPosition per power-hungry stage-plot item,
 * with a sensible outlet count pre-filled.
 */
export function suggestPowerPositions(items: StagePlotItem[]): PowerPosition[] {
  return items
    .filter((i): i is StagePlotItem & { type: keyof typeof POWER_OUTLETS } =>
      i.type in POWER_OUTLETS,
    )
    .map((item) => ({
      id: uid('pwr'),
      location: item.label,
      outlets_needed: POWER_OUTLETS[item.type]!,
      notes: '',
    }))
}

// ── Member-centric versions (new stage plot format) ───────────────────────────

/**
 * Build a complete inputs list from StagePlotMemberItem[] by collecting
 * all inputs from every instrument slot across all placed members.
 */
export function suggestInputsFromMembers(items: StagePlotMemberItem[]): InputRow[] {
  const rows: InputRow[] = []
  let channel = 1
  for (const item of items) {
    for (const inst of item.instruments) {
      for (const input of inst.inputs) {
        rows.push({ ...input, id: uid('row'), channel: channel++ })
      }
    }
  }
  return rows
}

/**
 * Build monitor mixes from all monitor slots in the member stage plot.
 */
export function suggestMonitorsFromMembers(items: StagePlotMemberItem[]): MonitorMix[] {
  const mixes: MonitorMix[] = []
  for (const item of items) {
    for (const mon of item.monitors) {
      mixes.push({
        id:               uid('mon'),
        band_member_id:   item.band_member_id,
        custom_name:      mon.label || (item.temp_id ? 'Guest monitor' : ''),
        type:             mon.type as MonitorType,
        mix_description:  mon.mix_description,
        iem_own_pack:     mon.iem_own_pack,
        transmitter_model:mon.transmitter_model,
        frequency:        mon.frequency,
      })
    }
  }
  return mixes
}

/**
 * Collect backline requirements from members that have backline.needed = true.
 */
export function suggestBacklineFromMembers(items: StagePlotMemberItem[]): BacklineItem[] {
  return items
    .filter(i => i.backline?.needed)
    .map(i => ({
      id:               uid('bl'),
      category:         (i.backline.category as BacklineCategory) || 'other',
      name:             i.instruments[0]?.label || 'Backline',
      brand_preference: i.backline.brand_preference,
      specs:            i.backline.specs,
      notes:            i.backline.notes,
    }))
}

/**
 * Collect power positions from members that need outlets.
 */
export function suggestPowerFromMembers(items: StagePlotMemberItem[]): PowerPosition[] {
  return items
    .filter(i => (i.power?.outlets_needed ?? 0) > 0)
    .map(i => ({
      id:              uid('pwr'),
      location:        i.instruments[0]?.label || 'Stage position',
      outlets_needed:  i.power.outlets_needed,
      notes:           i.power.notes,
    }))
}
