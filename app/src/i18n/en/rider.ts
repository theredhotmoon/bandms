export default {
  // The per-musician rig editor (components/rig/*). It is the *input* side of
  // the tech rider: the sheet a venue prints lives in @bandms/rider-core and
  // is deliberately not translated here — it is a document, not chrome.
  rig: {
    // Keyed by the stable SignalChainType id, so a preset can be reworded in
    // either language without touching the data module. The channel *rows* a
    // preset builds are NOT here — see the note in signalChainPresets.ts.
    chains: {
      modeler_mono: { label: 'Modeler / Profiler — Mono', description: '1× mono DI (XLR or jack)' },
      modeler_stereo: { label: 'Modeler / Profiler — Stereo', description: '2× DI (L + R)' },
      amp_mic: { label: 'Amp — Mic only', description: '1× microphone on speaker cabinet' },
      amp_mic_di: { label: 'Amp — Mic + DI (parallel)', description: '1× mic + 1× DI (pre-amp split)' },
      amp_di: { label: 'Amp — Line / cab-sim DI', description: '1× DI from line out or cab simulator' },
      direct_mono: { label: 'Direct — Mono DI', description: '1× DI (jack or XLR)' },
      direct_stereo: { label: 'Direct — Stereo DI', description: '2× DI (L + R)' },
      drum_acoustic: { label: 'Acoustic drum kit', description: '10-ch standard: kick in/out, snare top/btm, hi-hat, 3 toms, 2 overheads' },
      drum_electronic: { label: 'Electronic / pad kit', description: '1–2 DI from drum module' },
      drum_hybrid: { label: 'Hybrid kit', description: '10-ch acoustic mics + 1× trigger DI' },
      vocal_mic: { label: 'Vocal — Wired mic', description: '1× wired microphone on stand' },
      vocal_wireless: { label: 'Vocal — Wireless', description: '1× wireless handheld (transmitter info in RF section)' },
      acoustic_di: { label: 'Acoustic — DI only', description: '1× DI from onboard pickup' },
      acoustic_mic: { label: 'Acoustic — Mic only', description: '1× clip or area mic' },
      acoustic_mic_di: { label: 'Acoustic — Mic + DI', description: '1× mic + 1× DI (blend at FOH)' },
      other: { label: 'Custom / Manual', description: 'Define inputs manually below' },
    },
    tabs: {
      inputs: 'Inputs',
      monitors: 'Monitors',
      backline: 'Backline',
      power: 'Power',
      wireless: 'Wireless',
      foh: 'FOH notes',
    },
    gig: {
      changed: 'Changed for this gig',
      changedFrom: 'Changed for this gig — differs from “{name}”',
      revert: 'Revert to saved rig',
      inherited: 'Inherited from “{name}”',
      noSavedRig: 'No saved rig linked — edits apply to this gig only',
    },
    foh: {
      hint: 'Anything the FOH engineer should know that does not fit the other sections.',
      placeholder: 'e.g. heavy reverb on the last song, no compression on the lead vocal…',
    },
    signalChain: {
      label: 'Signal chain / setup type',
      autoBuild: 'Auto-build channels from signal chain',
      generates: 'Generates {n} channel for “{name}” | Generates {n} channels for “{name}”',
      build: 'Build →',
      existingRows: '{n} existing row | {n} existing rows',
      replace: 'Replace',
    },
    inputs: {
      // `micDi` and `stand` are `|`-joined option lists in the template, not
      // plural forms — they are split on the pipe by the component.
      instrument: 'Instrument / source',
      micDi: 'Mic / DI',
      model: 'Model',
      stand: 'Stand',
      notes: 'Notes',
      // Keyed by the `noun` prop rather than interpolated. The template built
      // both of these by appending "s" to a free-text prop — fine for
      // "channel"/"extra channel", impossible in Polish, where the count form
      // changes the noun's ending (kanał / kanały / kanałów) and "extra"
      // agrees with it.
      empty: {
        channel: 'No channels yet — click “Add row” to start.',
        extraChannel: 'No extra channels yet — click “Add row” to start.',
      },
      count: {
        channel: '{n} channel | {n} channels',
        extraChannel: '{n} extra channel | {n} extra channels',
      },
      moveUp: 'Move up',
      moveDown: 'Move down',
      instrumentPlaceholder: 'e.g. Kick drum (in)',
      modelPlaceholder: 'e.g. SM57',
      notesPlaceholder: 'Optional notes…',
      removeRow: 'Remove row',
      addRow: '+ Add row',
      needsName: '{n} row needs an instrument name before this can be saved | {n} rows need an instrument name before this can be saved',
      micDiOptions: {
        mic: 'Mic',
        di: 'DI',
        micDi: 'Mic+DI',
      },
      standOptions: {
        shortBoom: 'Short boom',
        tallBoom: 'Tall boom',
        straight: 'Straight',
        lowTom: 'Low tom',
        desk: 'Desk',
        none: 'None',
        other: 'Other',
      },
    },
    monitors: {
      hint: "One entry per monitor send. A wedge and an IEM are two entries — IEM details flow into the rider's RF list automatically.",
      empty: 'No monitor sends yet.',
      item: 'Monitor {n}',
      remove: '✕ Remove',
      type: 'Type',
      wedge: '🔊 Wedge',
      iem: '🎧 IEM',
      configuration: 'Configuration',
      mono: 'Mono',
      stereo: 'Stereo',
      mix: 'Mix description — what should be in it?',
      mixPlaceholder: 'e.g. my vocals loud + kick, no guitars, click on left',
      pack: 'Wireless pack',
      ownPack: 'Own pack',
      venuePack: 'Venue pack needed',
      transmitter: 'Transmitter model',
      transmitterPlaceholder: 'e.g. Shure PSM300',
      frequency: 'Frequency (MHz)',
      frequencyPlaceholder: 'e.g. 606.000',
      add: '+ Add monitor send',
    },
    backline: {
      hint: 'Gear the promoter has to provide. Anything marked “brought by musician” stays here for reference but is left off the rider’s backline request.',
      empty: 'No backline requirements.',
      namePlaceholder: 'e.g. Drum kit, Bass rig',
      remove: '✕ Remove',
      promoterProvides: 'Promoter must provide',
      broughtByMusician: 'Brought by the musician',
      category: 'Category',
      brand: 'Brand preference',
      brandPlaceholder: 'e.g. Pearl, Fender, Marshall…',
      specs: 'Specs / configuration',
      specsPlaceholder: 'e.g. 5-piece kit, 22″ kick, 100W head + 4×12 cab…',
      notes: 'Notes',
      notesPlaceholder: 'Any additional requirements…',
      add: '+ Add backline item',
      // Keyed by the BacklineCategory enum value, so the template can look a
      // label up from the stored value with no second mapping to drift.
      categories: {
        drum_kit: 'Drum kit',
        guitar_amp: 'Guitar amp',
        bass_amp: 'Bass amp',
        keyboard: 'Keyboard / keys',
        other: 'Other',
      },
    },
    power: {
      hint: "Outlets needed at this stage position. Each position with at least one outlet becomes a row in the rider's power list.",
      outlets: 'Outlets needed (230V)',
      notes: 'Notes',
      notesPlaceholder: 'e.g. clean/isolated power, separate circuit from lighting',
    },
    wireless: {
      hint: "Wireless systems used at this position — transmitters and IEM packs. Frequencies are collected into the rider's RF coordination list.",
      empty: 'No wireless units.',
      remove: '✕ Remove',
      type: 'Type',
      brand: 'Brand / model',
      brandPlaceholder: 'e.g. Shure GLXD16',
      band: 'Frequency band',
      bandPlaceholder: 'e.g. 2.4 GHz, 606–630 MHz',
      ownership: 'Ownership',
      ownUnit: 'Own unit',
      venueProvides: 'Venue must provide',
      notes: 'Notes',
      notesPlaceholder: 'Anything the RF coordinator should know…',
      add: '+ Add wireless unit',
      types: {
        instrument: 'Instrument transmitter',
        vocal: 'Vocal / handheld wireless',
        iem: 'IEM pack (wireless monitor)',
        other: 'Other',
      },
    },
  },
}
