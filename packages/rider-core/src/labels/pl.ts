import type { RiderSheetLabels, InstrumentLabels } from './types'

/**
 * Polish instrument names.
 *
 * Written out rather than derived, because the icon catalogue's `label` is the
 * English source. The `InstrumentLabels` annotation is what forces this to
 * stay complete: a new icon in the catalogue fails this file's type-check
 * until it has a Polish name.
 */
export const PL_INSTRUMENT_LABELS: InstrumentLabels = {
  vocalist: 'Wokal prowadzący',
  backing_vocals: 'Chórki',
  electric_guitar: 'Gitara elektryczna',
  acoustic_guitar: 'Gitara akustyczna',
  bass_guitar: 'Gitara basowa',
  banjo: 'Banjo',
  keyboard: 'Keyboard',
  piano: 'Fortepian',
  synth: 'Syntezator',
  accordion: 'Akordeon',
  trumpet: 'Trąbka',
  trombone: 'Puzon',
  saxophone: 'Saksofon',
  flute: 'Flet',
  clarinet: 'Klarnet',
  harmonica: 'Harmonijka',
  brass: 'Instrumenty dęte (ogólnie)',
  violin: 'Skrzypce',
  cello: 'Wiolonczela',
  double_bass: 'Kontrabas',
  drums: 'Zestaw perkusyjny',
  percussion: 'Perkusjonalia',
  cajon: 'Cajón',
  dj_deck: 'Konsola DJ-ska',
  laptop: 'Laptop / odtwarzanie',
  guitar_amp: 'Wzmacniacz gitarowy',
  bass_amp: 'Wzmacniacz basowy',
  monitor_wedge: 'Odsłuch podłogowy',
  di_box: 'DI-box',
  rack: 'Rack',
  custom: 'Własny',
}

/**
 * The sheet in Polish.
 *
 * Audio engineering in Poland runs on English terms — a Polish FOH engineer
 * asks for "DI", "IEM" and a "show file", not translations of them. So the
 * jargon stays and the surrounding sentences are Polish. Translating "DI box"
 * to something descriptive would make the document *harder* to work from,
 * which is the opposite of the point.
 */
export const PL_RIDER_SHEET_LABELS: RiderSheetLabels = {
  toolbar: {
    badge: 'Rider techniczny',
    print: 'Drukuj / zapisz PDF',
  },
  cover: {
    title: 'Rider techniczny',
    logoAlt: 'Logo zespołu',
    musicians: 'Muzycy',
    totalInputs: 'Łącznie wejść',
    status: 'Status',
    active: 'Aktywny',
    draft: 'Szkic',
  },
  stage: {
    title: 'Plan sceny',
    back: 'TYŁ SCENY',
    audience: '▲ PUBLICZNOŚĆ ▲',
    guest: 'GOŚĆ',
  },
  musicians: {
    title: 'Konfiguracja muzyków',
    complete: '✓ Kompletne',
    incomplete: '⚠ Niekompletne',
    signalChain: 'Tor sygnału / wejścia',
    noInputs: 'Nie skonfigurowano wejść',
    monitors: 'Odsłuch / IEM',
    noMonitors: 'Nie skonfigurowano odsłuchów',
    wireless: 'Bezprzewodowe',
    backline: 'Wymagany backline',
    power: 'Zasilanie',
    fohNotes: 'Uwagi dla FOH',
    item: 'Element',
    outletsNeeded: 'Potrzebne gniazda',
  },
  inputs: {
    title: 'Pełna lista wejść',
  },
  monitorSummary: {
    title: 'Podsumowanie odsłuchów / IEM',
    wedge: 'Podłogowy',
    iem: 'IEM',
  },
  wirelessRegistry: {
    title: 'Rejestr RF / systemów bezprzewodowych',
  },
  backline: {
    title: 'Wymagania backline',
  },
  paFoh: {
    title: 'Wymagania PA / FOH',
    roomCoverage: 'Pokrycie sali',
    subwoofer: 'Subbasy',
    processing: 'Procesing',
    consolePreference: 'Preferowana konsoleta',
    engineer: 'Realizator FOH',
    ownEngineer: 'Zespół przyjeżdża z własnym realizatorem',
    showFile: 'Plik show',
    showFileValue: 'Tak — format: {format}',
    tbd: 'do ustalenia',
  },
  power: {
    title: 'Wymagania zasilania',
    cleanPower: 'Wymagane czyste / odseparowane zasilanie.',
  },
  columns: {
    channel: 'Kan.',
    source: 'Instrument / źródło',
    micDi: 'Mikrofon / DI',
    model: 'Model',
    stand: 'Statyw',
    notes: 'Uwagi',
    type: 'Typ',
    label: 'Etykieta',
    config: 'Konfiguracja',
    mixDescription: 'Opis miksu',
    iemModel: 'Model IEM',
    frequency: 'Częstotliwość',
    musician: 'Muzyk',
    musicianUnit: 'Muzyk / urządzenie',
    musicianItem: 'Muzyk / element',
    locationMusician: 'Miejsce / muzyk',
    brandModel: 'Marka / model',
    freqBand: 'Pasmo',
    own: 'Własne',
    ownUnit: 'Własne urządzenie',
    category: 'Kategoria',
    brandPreference: 'Preferowana marka',
    specs: 'Specyfikacja',
    outlets: 'Gniazda',
  },
  common: {
    yes: 'Tak',
    no: 'Nie',
    none: '—',
    guest: 'Gość',
    unknownMember: 'Muzyk #{id}',
  },
  chains: {
    modeler_mono: 'Modeler / profiler — mono',
    modeler_stereo: 'Modeler / profiler — stereo',
    amp_mic: 'Wzmacniacz — tylko mikrofon',
    amp_mic_di: 'Wzmacniacz — mikrofon + DI (równolegle)',
    amp_di: 'Wzmacniacz — DI z line out / symulatora kolumny',
    direct_mono: 'Bezpośrednio — DI mono',
    direct_stereo: 'Bezpośrednio — DI stereo',
    drum_acoustic: 'Akustyczny zestaw perkusyjny',
    drum_electronic: 'Zestaw elektroniczny / padowy',
    drum_hybrid: 'Zestaw hybrydowy',
    vocal_mic: 'Wokal — mikrofon przewodowy',
    vocal_wireless: 'Wokal — bezprzewodowy',
    acoustic_di: 'Akustyczny — tylko DI',
    acoustic_mic: 'Akustyczny — tylko mikrofon',
    acoustic_mic_di: 'Akustyczny — mikrofon + DI',
    other: 'Własny / ręcznie',
  },
  wirelessTypes: {
    instrument: 'Instrument',
    vocal: 'Wokal',
    iem: 'IEM',
    other: 'Inne',
  },
  backlineCategories: {
    drum_kit: 'Zestaw perkusyjny',
    guitar_amp: 'Wzmacniacz gitarowy',
    bass_amp: 'Wzmacniacz basowy',
    keyboard: 'Keyboard',
    other: 'Inne',
  },
  micDi: {
    'Mic': 'Mikrofon',
    'DI': 'DI',
    'Mic+DI': 'Mikrofon + DI',
  },
  instruments: PL_INSTRUMENT_LABELS,
}
