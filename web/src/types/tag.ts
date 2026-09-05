export interface Tag {
  id: number
  /** Resolved for the response's locale — the public site never sees the raw bag. */
  name: string
  slug_en: string
  slug_pl: string | null
  created_at: string
  updated_at: string
}
