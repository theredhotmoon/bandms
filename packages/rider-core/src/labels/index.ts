import type { RiderSheetLabels, InstrumentLabels } from './types'
import { EN_RIDER_SHEET_LABELS, EN_INSTRUMENT_LABELS } from './en'
import { PL_RIDER_SHEET_LABELS, PL_INSTRUMENT_LABELS } from './pl'

export type { RiderSheetLabels, InstrumentLabels } from './types'
export { EN_RIDER_SHEET_LABELS, EN_INSTRUMENT_LABELS } from './en'
export { PL_RIDER_SHEET_LABELS, PL_INSTRUMENT_LABELS } from './pl'

const SHEETS: Record<string, RiderSheetLabels> = {
  en: EN_RIDER_SHEET_LABELS,
  pl: PL_RIDER_SHEET_LABELS,
}

const INSTRUMENTS: Record<string, InstrumentLabels> = {
  en: EN_INSTRUMENT_LABELS,
  pl: PL_INSTRUMENT_LABELS,
}

/**
 * The sheet's vocabulary for a locale, falling back to English.
 *
 * `locale` is a plain string rather than a union on purpose: the two consumers
 * derive their locale from their own registry (`app/src/locales.ts`,
 * `web/src/lib/locales.ts`), and this package deliberately sits under both
 * without importing either. A locale with no bundle prints English, which is
 * the same fail-open rule the public site's copy resolution uses — a language
 * nobody has translated yet should give a venue a readable document, not an
 * empty one.
 */
export function riderSheetLabels(locale: string): RiderSheetLabels {
  return SHEETS[locale] ?? EN_RIDER_SHEET_LABELS
}

/** Instrument names alone, for surfaces that render a palette but no sheet. */
export function instrumentLabels(locale: string): InstrumentLabels {
  return INSTRUMENTS[locale] ?? EN_INSTRUMENT_LABELS
}

/** Substitute `{token}` placeholders — `showFileValue`, `unknownMember`. */
export function fillLabel(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}
