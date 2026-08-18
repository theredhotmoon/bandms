/**
 * Visual icon type for a stage-plot instrument slot.
 *
 * Lives in its own module because both the stage plot and the instrument
 * catalogue need it, and neither should have to import the other.
 *
 * Keep in sync with App\Enums\StagePlotType on the backend and with the icon
 * catalogue in @/utils/instrumentIcons.
 */
export type StagePlotItemType =
  // vocals
  | 'vocalist'
  | 'backing_vocals'
  // guitars & bass
  | 'electric_guitar'
  | 'acoustic_guitar'
  | 'bass_guitar'
  | 'banjo'
  // keys
  | 'keyboard'
  | 'piano'
  | 'synth'
  | 'accordion'
  // brass & wind
  | 'trumpet'
  | 'trombone'
  | 'saxophone'
  | 'flute'
  | 'clarinet'
  | 'harmonica'
  | 'brass'
  // strings
  | 'violin'
  | 'cello'
  | 'double_bass'
  // percussion
  | 'drums'
  | 'percussion'
  | 'cajon'
  // electronic
  | 'dj_deck'
  | 'laptop'
  // stage gear
  | 'guitar_amp'
  | 'bass_amp'
  | 'monitor_wedge'
  | 'di_box'
  | 'rack'
  // fallback
  | 'custom'
