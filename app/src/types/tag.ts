import type { Localized } from './website-module'

export interface Tag {
  id: number
  /** Resolved for the admin's current request locale — display only. */
  name: string
  /** The default locale's slug — the tag's stable key, the same in every language. */
  slug: string
  /** Every locale, as stored — the edit form's source of truth. */
  translations: {
    name: Localized
    slug: Localized
  }
  created_at: string
  updated_at: string
}

export interface TagPayload {
  name: Localized
  /** A blank locale is regenerated from that locale's name on save. */
  slug?: Localized
}
