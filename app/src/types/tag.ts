import type { Localized } from './website-module'

export interface Tag {
  id: number
  /** Resolved for the admin's current request locale — display only. */
  name: string
  slug_en: string
  slug_pl: string | null
  /** Both locales, as stored — the edit form's source of truth. */
  translations: {
    name: Localized
  }
  created_at: string
  updated_at: string
}

export interface TagPayload {
  name: Localized
  slug_en?: string | null
  slug_pl?: string | null
}
