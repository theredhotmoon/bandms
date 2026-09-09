import type { StagePlotItemType } from './instrumentType'

export interface Instrument {
  id: number
  /** Resolved for the current request's locale — display only. */
  name: string
  category: string | null
  stage_plot_type: StagePlotItemType | null
  /** Both locales, as stored — the admin edit form's source of truth. */
  translations: { name: Record<string, string | null> }
  created_at: string
  updated_at: string
}

export interface InstrumentPayload {
  /** One key per registered locale; a locale left out is left untouched. */
  name: Record<string, string | null | undefined>
  category?: string | null
  stage_plot_type?: StagePlotItemType | null
}
