/**
 * instrumentIcons.ts
 *
 * Vector icon catalogue for stage-plot instrument types.
 *
 * Every icon is drawn on a 24x24 grid from simple primitives so it can be
 * rendered inline (standalone <svg> or nested inside the public rider's SVG
 * stage) and inherit colour from `currentColor`. No raw markup strings are
 * stored — shapes are structured data, rendered by InstrumentIcon.vue.
 */

import type { StagePlotItemType } from '@/types/techRider'

export type IconShape =
  | { kind: 'path';    d: string; filled?: boolean }
  | { kind: 'circle';  cx: number; cy: number; r: number; filled?: boolean }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; filled?: boolean }
  | { kind: 'line';    x1: number; y1: number; x2: number; y2: number }
  | { kind: 'rect';    x: number; y: number; w: number; h: number; rx?: number; filled?: boolean }

export type InstrumentGroup =
  | 'Vocals'
  | 'Guitars & Bass'
  | 'Keys'
  | 'Brass & Wind'
  | 'Strings'
  | 'Percussion'
  | 'Electronic'
  | 'Stage gear'
  | 'Other'

export interface InstrumentIconDef {
  type: StagePlotItemType
  label: string
  group: InstrumentGroup
  /** Extra search terms for the icon picker (label is always searched). */
  keywords: string[]
  shapes: IconShape[]
}

const p  = (d: string, filled = false): IconShape => ({ kind: 'path', d, filled })
const c  = (cx: number, cy: number, r: number, filled = false): IconShape => ({ kind: 'circle', cx, cy, r, filled })
const e  = (cx: number, cy: number, rx: number, ry: number, filled = false): IconShape =>
  ({ kind: 'ellipse', cx, cy, rx, ry, filled })
const l  = (x1: number, y1: number, x2: number, y2: number): IconShape => ({ kind: 'line', x1, y1, x2, y2 })
const r_ = (x: number, y: number, w: number, h: number, rx = 0, filled = false): IconShape =>
  ({ kind: 'rect', x, y, w, h, rx, filled })

// ── Catalogue ─────────────────────────────────────────────────────────────────
// Order matters: this drives the palette and the picker grid.

export const INSTRUMENT_ICON_CATALOG: InstrumentIconDef[] = [
  // ── Vocals ─────────────────────────────────────────────────────────────────
  {
    type: 'vocalist',
    label: 'Lead Vocals',
    group: 'Vocals',
    keywords: ['singer', 'mic', 'microphone', 'voice', 'vox'],
    shapes: [
      p('M12 2.5a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-5 0V5A2.5 2.5 0 0 1 12 2.5z'),
      l(10, 5.4, 14, 5.4),
      l(10, 7.4, 14, 7.4),
      p('M7.5 9.5a4.5 4.5 0 0 0 9 0'),
      l(12, 14, 12, 19.5),
      l(9.3, 21.3, 14.7, 21.3),
    ],
  },
  {
    type: 'backing_vocals',
    label: 'Backing Vocals',
    group: 'Vocals',
    keywords: ['bv', 'choir', 'harmony', 'mic', 'second voice'],
    shapes: [
      p('M9.5 2.5a2 2 0 0 1 2 2v4a2 2 0 0 1-4 0v-4a2 2 0 0 1 2-2z'),
      p('M6 8.5a3.5 3.5 0 0 0 7 0'),
      l(9.5, 12, 9.5, 19.5),
      l(7, 21.3, 12, 21.3),
      p('M16.2 6.6a4.2 4.2 0 0 1 0 6.6'),
      p('M19 4.4a7.4 7.4 0 0 1 0 11'),
    ],
  },

  // ── Guitars & Bass ─────────────────────────────────────────────────────────
  {
    type: 'electric_guitar',
    label: 'Electric Guitar',
    group: 'Guitars & Bass',
    keywords: ['guitar', 'lead', 'rhythm', 'strat', 'les paul', 'gtr'],
    shapes: [
      r_(10.6, 1.4, 2.8, 2.4, 0.6),
      l(12, 3.8, 12, 8.6),
      p('M12 8.6C9.6 8.2 6.6 8 5.2 9c-1.2.9.4 3 1.6 4.4-1.4 1-2 2.5-1.6 4 .6 2.3 3.4 3.8 6.8 3.8s6.2-1.5 6.8-3.8c.4-1.5-.2-3-1.6-4 1.2-1.4 2.8-3.5 1.6-4.4-1.4-1-4.4-.8-6.8-.4z'),
      r_(9.2, 14.4, 5.6, 1.7, 0.4),
      r_(9.2, 16.8, 5.6, 1.7, 0.4),
      l(9.6, 19.8, 14.4, 19.8),
    ],
  },
  {
    type: 'acoustic_guitar',
    label: 'Acoustic Guitar',
    group: 'Guitars & Bass',
    keywords: ['guitar', 'steel string', 'unplugged', 'folk'],
    shapes: [
      r_(11.1, 1.8, 1.8, 4.2, 0.6),
      p('M12 5.8c-2.3 0-4 1.7-4 3.6 0 1.1.5 1.8-.3 2.7C6.5 13.3 6 14.8 6 16.3c0 3 2.6 5.3 6 5.3s6-2.3 6-5.3c0-1.5-.5-3-1.7-4.2-.8-.9-.3-1.6-.3-2.7 0-1.9-1.7-3.6-4-3.6z'),
      c(12, 15.3, 2),
      l(9.6, 19.2, 14.4, 19.2),
    ],
  },
  {
    type: 'bass_guitar',
    label: 'Bass Guitar',
    group: 'Guitars & Bass',
    keywords: ['bass', 'four string', 'precision', 'jazz bass', 'low end'],
    shapes: [
      r_(10.4, 1.2, 3.2, 3, 0.6),
      l(10.4, 2.2, 8.8, 2.2),
      l(10.4, 3.4, 8.8, 3.4),
      l(12, 4.2, 12, 10),
      p('M12 10c-2.2-.4-5-.6-6.3.3-1.1.8.4 2.7 1.5 3.9-1.2.9-1.8 2.2-1.4 3.6.6 2.1 3.1 3.4 6.2 3.4s5.6-1.3 6.2-3.4c.4-1.4-.2-2.7-1.4-3.6 1.1-1.2 2.6-3.1 1.5-3.9-1.3-.9-4.1-.7-6.3-.3z'),
      r_(9.4, 15.4, 5.2, 1.8, 0.4),
      l(9.6, 19.2, 14.4, 19.2),
    ],
  },
  {
    type: 'banjo',
    label: 'Banjo',
    group: 'Guitars & Bass',
    keywords: ['bluegrass', 'five string', 'folk'],
    shapes: [
      c(9.6, 15.4, 5.6),
      c(9.6, 15.4, 3.4),
      l(13.6, 11.4, 20.2, 4.8),
      p('M19.4 4l2.4 2.4-1.4 1.4-2.4-2.4z'),
    ],
  },

  // ── Keys ───────────────────────────────────────────────────────────────────
  {
    type: 'keyboard',
    label: 'Keyboard',
    group: 'Keys',
    keywords: ['keys', 'piano', 'stage piano', 'nord'],
    shapes: [
      r_(2.5, 7, 19, 10, 1.5),
      r_(5.2, 7, 1.8, 5.2, 0.2, true),
      r_(8, 7, 1.8, 5.2, 0.2, true),
      r_(12.4, 7, 1.8, 5.2, 0.2, true),
      r_(15.2, 7, 1.8, 5.2, 0.2, true),
      r_(18, 7, 1.8, 5.2, 0.2, true),
      l(6.1, 12.2, 6.1, 17),
      l(8.9, 12.2, 8.9, 17),
      l(11.3, 12.2, 11.3, 17),
      l(13.3, 12.2, 13.3, 17),
      l(16.1, 12.2, 16.1, 17),
      l(18.9, 12.2, 18.9, 17),
    ],
  },
  {
    type: 'piano',
    label: 'Grand Piano',
    group: 'Keys',
    keywords: ['acoustic piano', 'grand', 'upright', 'concert'],
    shapes: [
      p('M3.5 20.5V6.5a3 3 0 0 1 3-3H12a8.5 8.5 0 0 1 0 17H3.5z'),
      l(3.5, 16.2, 12.1, 16.2),
      l(12.1, 16.2, 12.1, 20.5),
      l(5.2, 16.2, 5.2, 20.5),
      l(6.9, 16.2, 6.9, 20.5),
      l(8.6, 16.2, 8.6, 20.5),
      l(10.3, 16.2, 10.3, 20.5),
      r_(4.5, 16.2, 1.2, 2.4, 0, true),
      r_(7.5, 16.2, 1.2, 2.4, 0, true),
      r_(9.8, 16.2, 1.2, 2.4, 0, true),
    ],
  },
  {
    type: 'synth',
    label: 'Synthesizer',
    group: 'Keys',
    keywords: ['synthesiser', 'analog', 'moog', 'modular', 'pads'],
    shapes: [
      r_(2.5, 4.5, 19, 15, 2),
      c(6.5, 8.5, 1.8),
      l(6.5, 7.1, 6.5, 8.5),
      c(11, 8.5, 1.8),
      l(11, 7.1, 11, 8.5),
      l(15.2, 6.4, 15.2, 10.8),
      l(18.4, 6.4, 18.4, 10.8),
      l(2.5, 13.4, 21.5, 13.4),
      r_(5, 13.4, 1.5, 3, 0.2, true),
      r_(8.2, 13.4, 1.5, 3, 0.2, true),
      r_(13, 13.4, 1.5, 3, 0.2, true),
      r_(16.2, 13.4, 1.5, 3, 0.2, true),
    ],
  },
  {
    type: 'accordion',
    label: 'Accordion',
    group: 'Keys',
    keywords: ['squeezebox', 'bandoneon', 'folk'],
    shapes: [
      r_(2.2, 4.5, 4, 15, 1),
      r_(17.8, 4.5, 4, 15, 1),
      l(6.2, 4.8, 17.8, 4.8),
      l(6.2, 19.2, 17.8, 19.2),
      l(7.4, 4.8, 9.2, 19.2),
      l(11, 4.8, 9.2, 19.2),
      l(11, 4.8, 12.8, 19.2),
      l(14.6, 4.8, 12.8, 19.2),
      l(14.6, 4.8, 16.4, 19.2),
      l(3.2, 7.5, 5.2, 7.5),
      l(3.2, 10, 5.2, 10),
      l(3.2, 12.5, 5.2, 12.5),
      c(19.8, 7.6, 0.8, true),
      c(19.8, 10.4, 0.8, true),
    ],
  },

  // ── Brass & Wind ───────────────────────────────────────────────────────────
  {
    type: 'trumpet',
    label: 'Trumpet',
    group: 'Brass & Wind',
    keywords: ['brass', 'horn', 'cornet', 'flugelhorn'],
    shapes: [
      p('M6 10.5h11v3H6a1.5 1.5 0 0 1 0-3z'),
      p('M17 10.5l4.5-4v11l-4.5-4z'),
      r_(8.4, 7, 1.6, 3.5, 0.3),
      r_(11.2, 7, 1.6, 3.5, 0.3),
      r_(14, 7, 1.6, 3.5, 0.3),
      l(4.5, 12, 3.2, 12),
      l(3.2, 10.6, 3.2, 13.4),
    ],
  },
  {
    type: 'trombone',
    label: 'Trombone',
    group: 'Brass & Wind',
    keywords: ['brass', 'slide', 'bone', 'horn'],
    shapes: [
      p('M16.8 9l4.7-3.5v13L16.8 15z'),
      l(16.8, 10.5, 5.5, 10.5),
      l(16.8, 13.5, 5.5, 13.5),
      p('M5.5 10.5a1.5 1.5 0 0 0 0 3'),
      l(9, 10.5, 9, 13.5),
      l(16.8, 9, 16.8, 15),
    ],
  },
  {
    type: 'saxophone',
    label: 'Saxophone',
    group: 'Brass & Wind',
    keywords: ['sax', 'alto', 'tenor', 'baritone', 'horn', 'wind'],
    shapes: [
      p('M8.2 3.6V13.6a3 3 0 0 0 6 0V10'),
      p('M12.2 10.2L11 5.4h6.4l-1.2 4.8'),
      l(8.2, 3.6, 6.4, 1.9),
      c(8.2, 6.6, 0.9, true),
      c(8.2, 9.4, 0.9, true),
      c(8.2, 12.2, 0.9, true),
    ],
  },
  {
    type: 'flute',
    label: 'Flute',
    group: 'Brass & Wind',
    keywords: ['woodwind', 'piccolo', 'wind'],
    shapes: [
      p('M4 10.5h16a1.5 1.5 0 0 1 0 3H4a1.5 1.5 0 0 1 0-3z'),
      c(6.5, 12, 1),
      c(10, 12, 0.8, true),
      c(12.5, 12, 0.8, true),
      c(15, 12, 0.8, true),
      c(17.5, 12, 0.8, true),
      l(10, 9, 10, 10.5),
      l(15, 9, 15, 10.5),
    ],
  },
  {
    type: 'clarinet',
    label: 'Clarinet',
    group: 'Brass & Wind',
    keywords: ['woodwind', 'oboe', 'wind', 'reed'],
    shapes: [
      p('M11.3 4l.7-1.9.7 1.9z'),
      r_(11.1, 4, 1.8, 12, 0.3),
      l(11.1, 7.4, 12.9, 7.4),
      p('M10.7 16h2.6l1.6 5.2H9.1z'),
      c(12, 9.6, 0.75, true),
      c(12, 12, 0.75, true),
      c(12, 14.4, 0.75, true),
    ],
  },
  {
    type: 'harmonica',
    label: 'Harmonica',
    group: 'Brass & Wind',
    keywords: ['harp', 'blues harp', 'mouth organ'],
    shapes: [
      r_(2.5, 8.5, 19, 7, 1.5),
      l(2.5, 10.5, 21.5, 10.5),
      l(2.5, 13.5, 21.5, 13.5),
      r_(4.8, 10.5, 1.6, 3, 0, true),
      r_(7.6, 10.5, 1.6, 3, 0, true),
      r_(10.4, 10.5, 1.6, 3, 0, true),
      r_(13.2, 10.5, 1.6, 3, 0, true),
      r_(16, 10.5, 1.6, 3, 0, true),
      r_(18.8, 10.5, 1.6, 3, 0, true),
    ],
  },
  {
    type: 'brass',
    label: 'Brass (generic)',
    group: 'Brass & Wind',
    keywords: ['french horn', 'tuba', 'horn section', 'euphonium'],
    shapes: [
      c(10.4, 11.8, 6.4),
      c(10.4, 11.8, 3.2),
      p('M14.4 15.2l6.6-2.8v9l-6.6-2.8z'),
      l(11.6, 5.5, 14.2, 3.6),
    ],
  },

  // ── Strings ────────────────────────────────────────────────────────────────
  {
    type: 'violin',
    label: 'Violin',
    group: 'Strings',
    keywords: ['fiddle', 'viola', 'strings', 'bow'],
    shapes: [
      c(11.2, 2.5, 1.3),
      l(12.2, 3.4, 12.2, 6.4),
      p('M12 6.2c-2.2 0-3.7 1.6-3.7 3.4 0 1-.4 1.4-1 2-1.3 1.2-1.7 2.7-1.7 4.1 0 2.9 2.5 5.1 6.4 5.1s6.4-2.2 6.4-5.1c0-1.4-.4-2.9-1.7-4.1-.6-.6-1-1-1-2 0-1.8-1.5-3.4-3.7-3.4z'),
      l(11.1, 6.6, 11.1, 17.2),
      l(12.9, 6.6, 12.9, 17.2),
      l(9.8, 17.2, 14.2, 17.2),
      p('M11.1 17.6h1.8l-.4 2.8h-1z', true),
      p('M8.8 12.6c-.8 1-.8 2.6 0 3.6'),
      p('M15.2 12.6c.8 1 .8 2.6 0 3.6'),
    ],
  },
  {
    type: 'cello',
    label: 'Cello',
    group: 'Strings',
    keywords: ['strings', 'bow', 'violoncello'],
    shapes: [
      l(12, 1.6, 12, 5.8),
      p('M12 5.6c-2 0-3.4 1.5-3.4 3.1 0 .9-.3 1.3-.9 1.9-1.2 1.1-1.6 2.5-1.6 3.8 0 2.7 2.3 4.7 5.9 4.7s5.9-2 5.9-4.7c0-1.3-.4-2.7-1.6-3.8-.6-.6-.9-1-.9-1.9 0-1.6-1.4-3.1-3.4-3.1z'),
      l(11.2, 6, 11.2, 16.2),
      l(12.8, 6, 12.8, 16.2),
      l(9.9, 16.2, 14.1, 16.2),
      p('M9.2 11.6c-.7.9-.7 2.4 0 3.3'),
      p('M14.8 11.6c.7.9.7 2.4 0 3.3'),
      l(12, 19.1, 12, 22.4),
    ],
  },
  {
    type: 'double_bass',
    label: 'Double Bass',
    group: 'Strings',
    keywords: ['upright bass', 'contrabass', 'stand up bass', 'strings'],
    shapes: [
      c(11.1, 1.9, 1.2),
      l(12.1, 2.9, 12.1, 6),
      p('M12 5.8c-2.5 0-4.2 1.8-4.2 3.6 0 1-.4 1.5-1.1 2.2C5.2 12.9 4.7 14.6 4.7 16.2c0 3.1 2.8 5.4 7.3 5.4s7.3-2.3 7.3-5.4c0-1.6-.5-3.3-2-4.6-.7-.7-1.1-1.2-1.1-2.2 0-1.8-1.7-3.6-4.2-3.6z'),
      l(11.1, 6.2, 11.1, 17.4),
      l(12.9, 6.2, 12.9, 17.4),
      l(9.6, 17.4, 14.4, 17.4),
      p('M8.6 12.4c-.8 1.1-.8 2.9 0 4'),
      p('M15.4 12.4c.8 1.1.8 2.9 0 4'),
      l(12, 21.6, 12, 23.2),
    ],
  },

  // ── Percussion ─────────────────────────────────────────────────────────────
  {
    type: 'drums',
    label: 'Drum Kit',
    group: 'Percussion',
    keywords: ['drummer', 'kit', 'snare', 'kick', 'percussion'],
    shapes: [
      p('M12 4.9c3.6 0 6.5 1.2 6.5 2.6S15.6 10.1 12 10.1 5.5 8.9 5.5 7.5 8.4 4.9 12 4.9z'),
      p('M5.5 7.5v6c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6v-6'),
      p('M5.5 9.6l3.2 2.7 3.3-2.7 3.3 2.7 3.2-2.7'),
      l(7.4, 2.6, 11, 5.6),
      l(16.6, 2.6, 13, 5.6),
      l(6.4, 18.6, 17.6, 18.6),
    ],
  },
  {
    type: 'percussion',
    label: 'Percussion',
    group: 'Percussion',
    keywords: ['congas', 'bongos', 'timbales', 'shaker', 'aux perc'],
    shapes: [
      e(7.6, 7.4, 3.1, 1.6),
      p('M4.5 7.4l1.2 11h3.8l1.2-11'),
      e(16.8, 10.4, 2.7, 1.4),
      p('M14.1 10.4l1 8h3.4l1-8'),
      l(4.6, 9.8, 10.6, 9.8),
      l(14.2, 12.4, 19.4, 12.4),
    ],
  },
  {
    type: 'cajon',
    label: 'Cajón',
    group: 'Percussion',
    keywords: ['box drum', 'acoustic percussion', 'flamenco'],
    shapes: [
      r_(5, 3.5, 14, 17, 1),
      c(12, 8.5, 2),
      l(5, 16.5, 19, 16.5),
      l(8, 20.5, 8, 22),
      l(16, 20.5, 16, 22),
    ],
  },

  // ── Electronic ─────────────────────────────────────────────────────────────
  {
    type: 'dj_deck',
    label: 'DJ Deck',
    group: 'Electronic',
    keywords: ['turntable', 'cdj', 'vinyl', 'controller', 'decks'],
    shapes: [
      r_(2.5, 4.5, 19, 15, 2),
      c(9.5, 12, 5),
      c(9.5, 12, 1.1, true),
      p('M18.5 7.5v4.6l-3.1 2.6'),
      l(16.4, 17.4, 19.8, 17.4),
      l(18.4, 16.4, 18.4, 18.4),
    ],
  },
  {
    type: 'laptop',
    label: 'Laptop / Playback',
    group: 'Electronic',
    keywords: ['backing track', 'ableton', 'tracks', 'click', 'computer'],
    shapes: [
      r_(4.5, 4.5, 15, 10, 1.2),
      p('M2.5 17h19l-.8 1.6a1 1 0 0 1-.9.6H4.2a1 1 0 0 1-.9-.6z'),
      p('M10.4 7.4l4.6 2.6-4.6 2.6z', true),
    ],
  },

  // ── Stage gear ─────────────────────────────────────────────────────────────
  {
    type: 'guitar_amp',
    label: 'Guitar Amp',
    group: 'Stage gear',
    keywords: ['combo', 'cab', 'backline', 'marshall', 'fender'],
    shapes: [
      r_(3.5, 4.5, 17, 15, 1.5),
      l(3.5, 8.5, 20.5, 8.5),
      c(6.8, 6.5, 0.75, true),
      c(9.4, 6.5, 0.75, true),
      c(12, 6.5, 0.75, true),
      c(12, 14, 3.7),
      c(12, 14, 1.2, true),
      l(6, 19.5, 6, 21),
      l(18, 19.5, 18, 21),
    ],
  },
  {
    type: 'bass_amp',
    label: 'Bass Amp',
    group: 'Stage gear',
    keywords: ['bass cab', 'rig', 'backline', 'ampeg', 'di out'],
    shapes: [
      r_(4, 3.5, 16, 17, 1.5),
      l(4, 7, 20, 7),
      c(6.8, 5.2, 0.7, true),
      c(9.2, 5.2, 0.7, true),
      c(11.6, 5.2, 0.7, true),
      c(12, 12.3, 3.8),
      c(12, 12.3, 1.2, true),
      r_(8, 17.2, 8, 1.8, 0.9),
    ],
  },
  {
    type: 'monitor_wedge',
    label: 'Monitor Wedge',
    group: 'Stage gear',
    keywords: ['floor monitor', 'foldback', 'stage monitor', 'sidefill'],
    shapes: [
      p('M4 19h16l-2-11H8.6z'),
      c(12.4, 14.6, 3),
      c(11.2, 10.2, 1.2),
    ],
  },
  {
    type: 'di_box',
    label: 'DI Box',
    group: 'Stage gear',
    keywords: ['direct box', 'radial', 'active di', 'passive di'],
    shapes: [
      r_(4, 7, 16, 10, 1.5),
      c(7.6, 12, 1.6),
      c(16.4, 12, 1.6),
      r_(11, 10.4, 2, 3.2, 0.4),
      l(4, 9.2, 20, 9.2),
    ],
  },
  {
    type: 'rack',
    label: 'Rack Unit',
    group: 'Stage gear',
    keywords: ['19 inch', 'processor', 'receiver', 'flight case'],
    shapes: [
      r_(3.5, 3.5, 17, 17, 1.5),
      l(3.5, 9, 20.5, 9),
      l(3.5, 14.5, 20.5, 14.5),
      c(17.5, 6.2, 0.8, true),
      c(17.5, 11.7, 0.8, true),
      c(17.5, 17.2, 0.8, true),
      l(5.5, 6.2, 11, 6.2),
      l(5.5, 11.7, 11, 11.7),
      l(5.5, 17.2, 11, 17.2),
    ],
  },

  // ── Other ──────────────────────────────────────────────────────────────────
  {
    type: 'custom',
    label: 'Custom',
    group: 'Other',
    keywords: ['other', 'misc', 'generic', 'music'],
    shapes: [
      c(7.6, 17.6, 2.6),
      c(16.4, 15.4, 2.6),
      l(10.2, 17.6, 10.2, 4.4),
      l(19, 15.4, 19, 2.2),
      p('M10.2 4.4L19 2.2v3.6l-8.8 2.2z', true),
    ],
  },
]

// ── Lookups ───────────────────────────────────────────────────────────────────

const BY_TYPE = new Map<StagePlotItemType, InstrumentIconDef>(
  INSTRUMENT_ICON_CATALOG.map(def => [def.type, def]),
)

const FALLBACK = BY_TYPE.get('custom')!

export function instrumentIcon(type: StagePlotItemType | null | undefined): InstrumentIconDef {
  return (type && BY_TYPE.get(type)) || FALLBACK
}

export function instrumentIconShapes(type: StagePlotItemType | null | undefined): IconShape[] {
  return instrumentIcon(type).shapes
}

export function instrumentIconLabel(type: StagePlotItemType | null | undefined): string {
  return instrumentIcon(type).label
}

export function isKnownInstrumentType(value: string): value is StagePlotItemType {
  return BY_TYPE.has(value as StagePlotItemType)
}

/** Catalogue grouped for the picker, preserving catalogue order within a group. */
export const INSTRUMENT_ICON_GROUPS: { group: InstrumentGroup; icons: InstrumentIconDef[] }[] =
  INSTRUMENT_ICON_CATALOG.reduce<{ group: InstrumentGroup; icons: InstrumentIconDef[] }[]>((acc, def) => {
    const bucket = acc.find(g => g.group === def.group)
    if (bucket) bucket.icons.push(def)
    else acc.push({ group: def.group, icons: [def] })
    return acc
  }, [])

/** Case-insensitive search over label + keywords + type. */
export function searchInstrumentIcons(term: string): InstrumentIconDef[] {
  const q = term.trim().toLowerCase()
  if (!q) return INSTRUMENT_ICON_CATALOG
  return INSTRUMENT_ICON_CATALOG.filter(def =>
    def.label.toLowerCase().includes(q) ||
    def.type.replace(/_/g, ' ').includes(q) ||
    def.keywords.some(k => k.includes(q)),
  )
}

/**
 * Best-effort mapping from a free-text instrument name (e.g. the name of an
 * Instrument record) to an icon type. Used to pre-fill the icon when a member's
 * profile instrument has no explicit stage_plot_type yet.
 */
export function guessInstrumentType(name: string): StagePlotItemType | null {
  const n = name.trim().toLowerCase()
  if (!n) return null

  // Ordered most-specific first. Patterns match word stems, not whole words,
  // so player forms resolve too ("Trombonist", "Pianist", "Bassist", "Flutist").
  const rules: [RegExp, StagePlotItemType][] = [
    [/laptop|playback|backing track|ableton|click/, 'laptop'],
    [/guitar\s*amp|gtr\s*amp|combo|cabinet|cab/, 'guitar_amp'],
    [/bass\s*amp|bass\s*(cab|rig)/,           'bass_amp'],
    [/backing|choir|harmony/,                 'backing_vocals'],
    [/vocal|singer|vox\b|\bvoc\b/,            'vocalist'],
    [/double\s*bass|contrabass|upright bass/, 'double_bass'],
    [/bass/,                                  'bass_guitar'],
    [/acoustic|nylon|classical guitar/,       'acoustic_guitar'],
    [/guitar|gtr/,                            'electric_guitar'],
    [/banjo/,                                 'banjo'],
    [/pian/,                                  'piano'],
    [/synth|moog|prophet/,                    'synth'],
    [/keys|keyboard|rhodes|organ/,            'keyboard'],
    [/accordion|bandoneon/,                   'accordion'],
    [/trumpet|cornet|flugel/,                 'trumpet'],
    [/trombon/,                               'trombone'],
    [/sax/,                                   'saxophone'],
    [/flut|flaut|piccolo/,                    'flute'],
    [/clarinet|oboe/,                         'clarinet'],
    [/harmonica|mouth organ/,                 'harmonica'],
    [/horn|tuba|euphonium|brass/,             'brass'],
    [/violin|fiddle|viola/,                   'violin'],
    [/cell/,                                  'cello'],
    [/cajon|cajón/,                           'cajon'],
    [/drum|kit/,                              'drums'],
    [/perc|conga|bongo|timbale|shaker/,       'percussion'],
    [/turntable|\bdj\b|decks|vinyl/,          'dj_deck'],
  ]

  for (const [re, type] of rules) {
    if (re.test(n)) return type
  }
  return null
}
