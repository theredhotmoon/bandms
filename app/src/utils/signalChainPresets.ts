/**
 * signalChainPresets.ts
 *
 * Human-readable labels, descriptions, and input builders for each
 * signal chain type a band member can configure.
 */

import type { SignalChainType } from '@/types/bandMemberSetup'
import type { InputRow, MicDiChoice } from '@/types/techRider'

// ── Labels & descriptions ─────────────────────────────────────────────────────

export interface ChainMeta {
  label: string
  description: string
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
  modeler_mono:    { label: 'Modeler / Profiler — Mono',         description: '1× mono DI (XLR or jack)',                  channels: 1,  category: 'guitar_bass' },
  modeler_stereo:  { label: 'Modeler / Profiler — Stereo',       description: '2× DI (L + R)',                             channels: 2,  category: 'guitar_bass' },
  amp_mic:         { label: 'Amp — Mic only',                    description: '1× microphone on speaker cabinet',          channels: 1,  category: 'guitar_bass' },
  amp_mic_di:      { label: 'Amp — Mic + DI (parallel)',         description: '1× mic + 1× DI (pre-amp split)',            channels: 2,  category: 'guitar_bass' },
  amp_di:          { label: 'Amp — Line / cab-sim DI',           description: '1× DI from line out or cab simulator',      channels: 1,  category: 'guitar_bass' },
  direct_mono:     { label: 'Direct — Mono DI',                  description: '1× DI (jack or XLR)',                       channels: 1,  category: 'guitar_bass' },
  direct_stereo:   { label: 'Direct — Stereo DI',                description: '2× DI (L + R)',                             channels: 2,  category: 'guitar_bass' },
  drum_acoustic:   { label: 'Acoustic drum kit',                 description: '10-ch standard: kick in/out, snare top/btm, hi-hat, 3 toms, 2 overheads', channels: 10, category: 'drums' },
  drum_electronic: { label: 'Electronic / pad kit',              description: '1–2 DI from drum module',                  channels: 2,  category: 'drums' },
  drum_hybrid:     { label: 'Hybrid kit',                        description: '10-ch acoustic mics + 1× trigger DI',       channels: 11, category: 'drums' },
  vocal_mic:       { label: 'Vocal — Wired mic',                 description: '1× wired microphone on stand',              channels: 1,  category: 'vocals' },
  vocal_wireless:  { label: 'Vocal — Wireless',                  description: '1× wireless handheld (transmitter info in RF section)', channels: 1, category: 'vocals' },
  acoustic_di:     { label: 'Acoustic — DI only',                description: '1× DI from onboard pickup',                channels: 1,  category: 'acoustic' },
  acoustic_mic:    { label: 'Acoustic — Mic only',               description: '1× clip or area mic',                      channels: 1,  category: 'acoustic' },
  acoustic_mic_di: { label: 'Acoustic — Mic + DI',               description: '1× mic + 1× DI (blend at FOH)',             channels: 2,  category: 'acoustic' },
  other:           { label: 'Custom / Manual',                   description: 'Define inputs manually below',              channels: 0,  category: 'other' },
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

function makeRow(
  channel: number,
  instrument: string,
  mic_di: MicDiChoice,
  mic_model: string,
  stand_type: string,
  notes = '',
): InputRow {
  return { id: uid(), channel, instrument, mic_di, mic_model, stand_type, notes }
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
  let ch = 1

  const rows: InputRow[] = []

  switch (chainType) {
    case 'modeler_mono':
      rows.push(makeRow(ch++, `${pfx}${lbl} (DI)`, 'DI', '', 'None'))
      break

    case 'modeler_stereo':
      rows.push(makeRow(ch++, `${pfx}${lbl} — L (DI)`, 'DI', '', 'None'))
      rows.push(makeRow(ch++, `${pfx}${lbl} — R (DI)`, 'DI', '', 'None', 'Stereo pair'))
      break

    case 'amp_mic':
      rows.push(makeRow(ch++, `${pfx}${lbl} amp`, 'Mic', 'SM57', 'Short boom'))
      break

    case 'amp_mic_di':
      rows.push(makeRow(ch++, `${pfx}${lbl} amp (mic)`, 'Mic', 'SM57',   'Short boom'))
      rows.push(makeRow(ch++, `${pfx}${lbl} amp (DI)`,  'DI',  '',       'None',       'Pre-amp out / parallel split'))
      break

    case 'amp_di':
      rows.push(makeRow(ch++, `${pfx}${lbl} (line out / cab-sim)`, 'DI', '', 'None'))
      break

    case 'direct_mono':
      rows.push(makeRow(ch++, `${pfx}${lbl} (DI)`, 'DI', '', 'None'))
      break

    case 'direct_stereo':
      rows.push(makeRow(ch++, `${pfx}${lbl} — L`, 'DI', '', 'None'))
      rows.push(makeRow(ch++, `${pfx}${lbl} — R`, 'DI', '', 'None', 'Stereo pair'))
      break

    case 'drum_acoustic':
      rows.push(makeRow(ch++, `${pfx}Kick (in)`,     'Mic', 'AKG D112 / Beta 52A', 'Short boom'))
      rows.push(makeRow(ch++, `${pfx}Kick (out)`,    'Mic', 'SM91 / Beta 91A',     'None',       'Boundary'))
      rows.push(makeRow(ch++, `${pfx}Snare (top)`,   'Mic', 'SM57',                'Low tom'))
      rows.push(makeRow(ch++, `${pfx}Snare (btm)`,   'Mic', 'SM57',                'Low tom',    'Phase flip'))
      rows.push(makeRow(ch++, `${pfx}Hi-Hat`,         'Mic', 'SM81 / C451B',        'Short boom'))
      rows.push(makeRow(ch++, `${pfx}Tom 1`,          'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(ch++, `${pfx}Tom 2`,          'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(ch++, `${pfx}Floor Tom`,      'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(ch++, `${pfx}Overhead L`,     'Mic', 'SM81 / AKG C414',     'Tall boom'))
      rows.push(makeRow(ch++, `${pfx}Overhead R`,     'Mic', 'SM81 / AKG C414',     'Tall boom'))
      break

    case 'drum_electronic':
      rows.push(makeRow(ch++, `${pfx}Drum module — L`, 'DI', '', 'None'))
      rows.push(makeRow(ch++, `${pfx}Drum module — R`, 'DI', '', 'None', 'Stereo pair'))
      break

    case 'drum_hybrid':
      // Acoustic channels
      rows.push(makeRow(ch++, `${pfx}Kick (in)`,     'Mic', 'AKG D112 / Beta 52A', 'Short boom'))
      rows.push(makeRow(ch++, `${pfx}Kick (out)`,    'Mic', 'SM91 / Beta 91A',     'None',       'Boundary'))
      rows.push(makeRow(ch++, `${pfx}Snare (top)`,   'Mic', 'SM57',                'Low tom'))
      rows.push(makeRow(ch++, `${pfx}Snare (btm)`,   'Mic', 'SM57',                'Low tom',    'Phase flip'))
      rows.push(makeRow(ch++, `${pfx}Hi-Hat`,         'Mic', 'SM81 / C451B',        'Short boom'))
      rows.push(makeRow(ch++, `${pfx}Tom 1`,          'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(ch++, `${pfx}Tom 2`,          'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(ch++, `${pfx}Floor Tom`,      'Mic', 'e604 / MD421',        'Low tom'))
      rows.push(makeRow(ch++, `${pfx}Overhead L`,     'Mic', 'SM81 / AKG C414',     'Tall boom'))
      rows.push(makeRow(ch++, `${pfx}Overhead R`,     'Mic', 'SM81 / AKG C414',     'Tall boom'))
      // Trigger DI
      rows.push(makeRow(ch++, `${pfx}Trigger / module`, 'DI', '', 'None', 'Electronic pads / triggers'))
      break

    case 'vocal_mic':
      rows.push(makeRow(ch++, `${pfx}${lbl}`, 'Mic', 'SM58 / e945', 'Tall boom'))
      break

    case 'vocal_wireless':
      rows.push(makeRow(ch++, `${pfx}${lbl} (wireless)`, 'Mic', 'Shure ULXD / Beta 87A', 'None', 'Wireless — see RF section'))
      break

    case 'acoustic_di':
      rows.push(makeRow(ch++, `${pfx}${lbl} (DI)`, 'DI', '', 'None'))
      break

    case 'acoustic_mic':
      rows.push(makeRow(ch++, `${pfx}${lbl}`, 'Mic', 'DPA 4099 / AKG C414', 'Tall boom', 'Clip-on preferred'))
      break

    case 'acoustic_mic_di':
      rows.push(makeRow(ch++, `${pfx}${lbl} (mic)`, 'Mic', 'DPA 4099 / AKG C414', 'Tall boom', 'Clip-on preferred'))
      rows.push(makeRow(ch++, `${pfx}${lbl} (DI)`,  'DI',  '',                    'None',       'From onboard pickup'))
      break

    case 'other':
      // Leave empty — user fills manually
      break
  }

  return rows
}
