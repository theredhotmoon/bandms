import type { RiderSheetLabels, InstrumentLabels, InstrumentGroupLabels, ResolverLabels } from './types'
import { INSTRUMENT_TYPE_LABELS } from '../types/stagePlot'

/**
 * English instrument names.
 *
 * Aliased rather than retyped: `INSTRUMENT_ICON_CATALOG` already carries one
 * `label` per icon, and a second English list would be free to drift from the
 * palette the band picks from.
 */
export const EN_INSTRUMENT_LABELS: InstrumentLabels = INSTRUMENT_TYPE_LABELS

/** Also the default for `resolveRider()` when no bundle is passed. */
export const EN_RESOLVER_LABELS: ResolverLabels = {
  guest: 'Guest',
  guestNamed: '{name} (guest)',
  unknownMember: 'Member #{id}',
  noSavedRig: 'No saved rig',
  production: 'Production',
  addedOnRider: 'Added on the rider',
}

/** Identity map: the catalogue's `group` is already the English heading. */
export const EN_INSTRUMENT_GROUPS: InstrumentGroupLabels = {
  'Vocals': 'Vocals',
  'Guitars & Bass': 'Guitars & Bass',
  'Keys': 'Keys',
  'Brass & Wind': 'Brass & Wind',
  'Strings': 'Strings',
  'Percussion': 'Percussion',
  'Electronic': 'Electronic',
  'Stage gear': 'Stage gear',
  'Other': 'Other',
}

/**
 * The sheet in English — and the schema every other bundle is checked against.
 *
 * `chains` is word-for-word the admin's `rider.rig.chains.*.label`, because
 * the signal chain is the thing a band picks once and then reads back off the
 * printed sheet; two wordings for that is a real hazard.
 *
 * `wirelessTypes` and `backlineCategories` deliberately are **not**. The admin
 * renders them in a dropdown, where "IEM pack (wireless monitor)" earns its
 * length; the sheet renders them in a table cell an engineer scans, where
 * "IEM" is the useful string. The register differs, not the meaning — and it
 * already differed in English before these bundles existed.
 */
export const EN_RIDER_SHEET_LABELS: RiderSheetLabels = {
  toolbar: {
    badge: 'Tech Rider',
    print: 'Print / Save PDF',
  },
  cover: {
    title: 'Technical Rider',
    logoAlt: 'Band logo',
    musicians: 'Musicians',
    totalInputs: 'Total inputs',
    status: 'Status',
    active: 'Active',
    draft: 'Draft',
  },
  stage: {
    title: 'Stage Plot',
    back: 'STAGE BACK',
    audience: '▲ AUDIENCE ▲',
    guest: 'GUEST',
  },
  musicians: {
    title: 'Musician Configuration',
    complete: '✓ Complete',
    incomplete: '⚠ Incomplete',
    signalChain: 'Signal chain / Inputs',
    noInputs: 'No inputs configured',
    monitors: 'Monitor / IEM',
    noMonitors: 'No monitors configured',
    wireless: 'Wireless',
    backline: 'Backline required',
    power: 'Power',
    fohNotes: 'FOH notes',
    item: 'Item',
    outletsNeeded: 'Outlets needed',
  },
  inputs: {
    title: 'Complete Input List',
  },
  monitorSummary: {
    title: 'Monitor / IEM Summary',
    wedge: 'Wedge',
    iem: 'IEM',
  },
  wirelessRegistry: {
    title: 'RF / Wireless Registry',
  },
  backline: {
    title: 'Backline Requirements',
  },
  paFoh: {
    title: 'PA / FOH Requirements',
    roomCoverage: 'Room coverage',
    subwoofer: 'Subwoofer',
    processing: 'Processing',
    consolePreference: 'Console preference',
    engineer: 'FOH engineer',
    ownEngineer: 'Band brings own engineer',
    showFile: 'Show file',
    showFileValue: 'Yes — format: {format}',
    tbd: 'TBD',
  },
  power: {
    title: 'Power Requirements',
    cleanPower: 'Clean / isolated power required.',
  },
  columns: {
    channel: 'Ch',
    source: 'Instrument / Source',
    micDi: 'Mic / DI',
    model: 'Model',
    stand: 'Stand',
    notes: 'Notes',
    type: 'Type',
    label: 'Label',
    config: 'Config',
    mixDescription: 'Mix description',
    iemModel: 'IEM model',
    frequency: 'Frequency',
    musician: 'Musician',
    musicianUnit: 'Musician / Unit',
    musicianItem: 'Musician / Item',
    locationMusician: 'Location / Musician',
    brandModel: 'Brand / Model',
    freqBand: 'Freq. band',
    own: 'Own',
    ownUnit: 'Own unit',
    category: 'Category',
    brandPreference: 'Brand preference',
    specs: 'Specs',
    outlets: 'Outlets',
  },
  common: {
    yes: 'Yes',
    no: 'No',
    none: '—',
  },
  resolver: EN_RESOLVER_LABELS,
  chains: {
    modeler_mono: 'Modeler / Profiler — Mono',
    modeler_stereo: 'Modeler / Profiler — Stereo',
    amp_mic: 'Amp — Mic only',
    amp_mic_di: 'Amp — Mic + DI (parallel)',
    amp_di: 'Amp — Line / cab-sim DI',
    direct_mono: 'Direct — Mono DI',
    direct_stereo: 'Direct — Stereo DI',
    drum_acoustic: 'Acoustic drum kit',
    drum_electronic: 'Electronic / pad kit',
    drum_hybrid: 'Hybrid kit',
    vocal_mic: 'Vocal — Wired mic',
    vocal_wireless: 'Vocal — Wireless',
    acoustic_di: 'Acoustic — DI only',
    acoustic_mic: 'Acoustic — Mic only',
    acoustic_mic_di: 'Acoustic — Mic + DI',
    other: 'Custom / Manual',
  },
  wirelessTypes: {
    instrument: 'Instrument',
    vocal: 'Vocal',
    iem: 'IEM',
    other: 'Other',
  },
  backlineCategories: {
    drum_kit: 'Drum kit',
    guitar_amp: 'Guitar amp',
    bass_amp: 'Bass amp',
    keyboard: 'Keyboard',
    other: 'Other',
  },
  micDi: {
    'Mic': 'Mic',
    'DI': 'DI',
    'Mic+DI': 'Mic + DI',
  },
  instruments: EN_INSTRUMENT_LABELS,
}
