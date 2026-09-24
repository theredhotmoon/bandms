/**
 * signalChainPresets.ts
 *
 * Human-readable labels, descriptions, and input builders for each
 * signal chain type a band member can configure.
 */

import type { InputRow, MicDiChoice, SignalChainType } from '@bandms/rider-core'

// ── Signal-chain presets ─────────────────────────────────────────────────────
//
// The user-facing label and description of each preset live in the i18n
// catalogue under rider.rig.chains.<id>; this file keeps only the shape.
//
// EVERYTHING ELSE HERE IS DATA, NOT CHROME, AND MUST STAY ENGLISH:
//
//   * 'Mic' | 'DI' | 'Mic+DI' is the MicDiChoice union — a persisted value,
//     typed in @bandms/rider-core. Translating it breaks the data model.
//   * 'Short boom', 'None' and friends are stored in stand_type, and the
//     select that edits them renders the stored value as its own label.
//   * The channel names a preset builds are seeded INTO the user's table and
//     end up on the rider a venue prints. The sheet itself is deliberately
//     untranslated (it is a document, not chrome), and seeding Polish rows
//     would make a rider read half in each language depending on which UI
//     language the musician happened to have selected when they pressed
//     Build.
//
// So this file is deliberately NOT on the string lint's MIGRATED list. If a
// genuinely user-facing string is ever added here, move it to the catalogue
// instead of listing the file.

export interface ChainMeta {
  channels: number         // Expected channel count
  category: ChainCategory
}

export type ChainCategory =
  | 'guitar_bass'
  | 'drums'
  | 'vocals'
  | 'acoustic'
  | 'keys'
  | 'other'

export const CHAIN_META: Record<SignalChainType, ChainMeta> = {
  modeler_mono:    { channels: 1,  category: 'guitar_bass' },
  modeler_stereo:  { channels: 2,  category: 'guitar_bass' },
  amp_mic:         { channels: 1,  category: 'guitar_bass' },
  amp_mic_di:      { channels: 2,  category: 'guitar_bass' },
  amp_di:          { channels: 1,  category: 'guitar_bass' },
  direct_mono:     { channels: 1,  category: 'guitar_bass' },
  direct_stereo:   { channels: 2,  category: 'guitar_bass' },
  drum_acoustic:   { channels: 10, category: 'drums' },
  drum_electronic: { channels: 2,  category: 'drums' },
  drum_hybrid:     { channels: 11, category: 'drums' },
  vocal_mic:       { channels: 1,  category: 'vocals' },
  vocal_wireless:  { channels: 1, category: 'vocals' },
  acoustic_di:     { channels: 1,  category: 'acoustic' },
  acoustic_mic:    { channels: 1,  category: 'acoustic' },
  acoustic_mic_di: { channels: 2,  category: 'acoustic' },
  other:           { channels: 0,  category: 'other' },
}

// ── Categories exposed for instrument-aware filtering ─────────────────────────

export const CHAIN_BY_CATEGORY: Record<ChainCategory, SignalChainType[]> = {
  guitar_bass: ['modeler_mono', 'modeler_stereo', 'amp_mic', 'amp_mic_di', 'amp_di', 'direct_mono', 'direct_stereo'],
  drums:       ['drum_acoustic', 'drum_electronic', 'drum_hybrid'],
  vocals:      ['vocal_mic', 'vocal_wireless'],
  acoustic:    ['acoustic_di', 'acoustic_mic', 'acoustic_mic_di'],
  keys:        ['direct_stereo', 'direct_mono', 'modeler_stereo', 'modeler_mono'],
  other:       ['direct_mono', 'direct_stereo', 'other'],
}

// Maps common instrument name keywords → chain category
export const INSTRUMENT_CATEGORY_HINTS: [RegExp, ChainCategory][] = [
  [/drum|perc|kit/i,           'drums'],
  [/vocal|voice|sing/i,        'vocals'],
  [/key|piano|synth|organ/i,   'keys'],
  [/violin|viola|cello|string|acoustic|fiddle|mandolin|banjo|ukulele/i, 'acoustic'],
  [/brass|trumpet|trombone|sax|horn|flute|wind/i, 'acoustic'],
  [/guitar|bass/i,             'guitar_bass'],
]

export function guessChainCategory(instrumentName: string): ChainCategory {
  for (const [re, cat] of INSTRUMENT_CATEGORY_HINTS) {
    if (re.test(instrumentName)) return cat
  }
  return 'other'
}

// ── Input builders ────────────────────────────────────────────────────────────

function uid(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// No channel number: channels are numbered when the rider is resolved, so a
// preset only describes what the input *is*.
function makeRow(
  instrument: string,
  mic_di: MicDiChoice,
  mic_model: string,
  stand_type: string,
  notes = '',
): InputRow {
  return { id: uid(), instrument, mic_di, mic_model, stand_type, notes }
}

/**
 * Generate InputRow[] for a given signal chain type.
 * @param chainType  The member's chosen signal chain
 * @param memberName First + last name (used as prefix in instrument column)
 * @param instrName  Instrument name (used in instrument column)
 */
export function buildInputsFromChain(
  chainType: SignalChainType,
  memberName: string,
  instrName: string,
): InputRow[] {
  const pfx = memberName ? `${memberName} — ` : ''
  const lbl = instrName || 'Instrument'
  const rows: InputRow[] = []

  switch (chainType) {
    case 'modeler_mono':
      rows.push(makeRow(`${pfx}${lbl} (DI)`, 'DI', '', 'None'))
      break

    case 'modeler_stereo':
      rows.push(makeRow(`${pfx}${lbl} — L (DI)`, 'DI', '', 'None'))
      rows.push(makeRow(`${pfx}${lbl} — R (DI)`, 'DI', '', 'None', 'Stereo pair'))
      break

    case 'amp_mic':
      rows.push(makeRow(`${pfx}${lbl} amp`, 'Mic', 'SM57', 'Short boom'))
      break

    case 'amp_mic_di':
      rows.push(makeRow(`${pfx}${lbl} amp (mic)`, 'Mic', 'SM57',   'Short boom'))
      rows.push(makeRow(`${pfx}${lbl} amp (DI)`,  'DI',  '',       'None',       'Pre-amp out / parallel split'))
      break

    case 'amp_di':
      rows.push(makeRow(`${pfx}${lbl} (line out / cab-sim)`, 'DI', '', 'None'))
      break

    case 'direct_mono':
      rows.push(makeRow(`${pfx}${lbl} (DI)`, 'DI', '', 'None'))
      break

    case 'direct_stereo':
      rows.push(makeRow(`${pfx}${lbl} — L`, 'DI', '', 'None'))
      rows.push(makeRow(`${pfx}${lbl} — R`, 'DI', '', 'None', 'Stereo pair'))
      break

    case 'drum_acoustic':
      rows.push(makeRow(`${pfx}Kick (in)`,     'Mic', 'AKG D112 / Beta 52A', 'Short boom'))
      rows.push(makeRow(`${pfx}Kick (out)`,    'Mic', 'SM91 / Beta 91A',     'None',       'Boundary'))
      rows.push(makeRow(`${pfx}Snare (top)`,   'Mic', 'SM57',                'Low tom'))
      rows.push(makeRow(`${pfx}Snare (btm)`,   'Mic', 'SM57',                'Low tom',    'Phase flip'))
      rows.push(makeRow(`${pfx}Hi-Hat`,         'Mic', 'SM81 / C451B',        'Short boom'))
      rows.push(makeRow(`${pfx}Tom 1`,          'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(`${pfx}Tom 2`,          'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(`${pfx}Floor Tom`,      'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(`${pfx}Overhead L`,     'Mic', 'SM81 / AKG C414',     'Tall boom'))
      rows.push(makeRow(`${pfx}Overhead R`,     'Mic', 'SM81 / AKG C414',     'Tall boom'))
      break

    case 'drum_electronic':
      rows.push(makeRow(`${pfx}Drum module — L`, 'DI', '', 'None'))
      rows.push(makeRow(`${pfx}Drum module — R`, 'DI', '', 'None', 'Stereo pair'))
      break

    case 'drum_hybrid':
      // Acoustic channels
      rows.push(makeRow(`${pfx}Kick (in)`,     'Mic', 'AKG D112 / Beta 52A', 'Short boom'))
      rows.push(makeRow(`${pfx}Kick (out)`,    'Mic', 'SM91 / Beta 91A',     'None',       'Boundary'))
      rows.push(makeRow(`${pfx}Snare (top)`,   'Mic', 'SM57',                'Low tom'))
      rows.push(makeRow(`${pfx}Snare (btm)`,   'Mic', 'SM57',                'Low tom',    'Phase flip'))
      rows.push(makeRow(`${pfx}Hi-Hat`,         'Mic', 'SM81 / C451B',        'Short boom'))
      rows.push(makeRow(`${pfx}Tom 1`,          'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(`${pfx}Tom 2`,          'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(`${pfx}Floor Tom`,      'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(`${pfx}Overhead L`,     'Mic', 'SM81 / AKG C414',     'Tall boom'))
      rows.push(makeRow(`${pfx}Overhead R`,     'Mic', 'SM81 / AKG C414',     'Tall boom'))
      // Trigger DI
      rows.push(makeRow(`${pfx}Trigger / module`, 'DI', '', 'None', 'Electronic pads / triggers'))
      break

    case 'vocal_mic':
      rows.push(makeRow(`${pfx}${lbl}`, 'Mic', 'SM58 / e945', 'Tall boom'))
      break

    case 'vocal_wireless':
      rows.push(makeRow(`${pfx}${lbl} (wireless)`, 'Mic', 'Shure ULXD / Beta 87A', 'None', 'Wireless — see RF section'))
      break

    case 'acoustic_di':
      rows.push(makeRow(`${pfx}${lbl} (DI)`, 'DI', '', 'None'))
      break

    case 'acoustic_mic':
      rows.push(makeRow(`${pfx}${lbl}`, 'Mic', 'DPA 4099 / AKG C414', 'Tall boom', 'Clip-on preferred'))
      break

    case 'acoustic_mic_di':
      rows.push(makeRow(`${pfx}${lbl} (mic)`, 'Mic', 'DPA 4099 / AKG C414', 'Tall boom', 'Clip-on preferred'))
      rows.push(makeRow(`${pfx}${lbl} (DI)`,  'DI',  '',                    'None',       'From onboard pickup'))
      break

    case 'other':
      // Leave empty — user fills manually
      break
  }

  return rows
}
