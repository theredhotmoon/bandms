/**
 * stagePlotSuggestions.ts
 *
 * Pure functions that derive tech-rider list data from a stage plot.
 * Each function scans StagePlotItem[] and returns pre-populated rows
 * for the Inputs, Monitors, Backline, and Power sections.
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
