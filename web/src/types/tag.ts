export interface Tag {
  id: number
  /** Resolved for the response's locale — the public site never sees the raw bag. */
  name: string
  /**
   * The default locale's slug: the tag's stable key, identical in every
   * language, which is what the filters key on. (It was `slug_en`.)
   */
  slug: string
  created_at: string
  updated_at: string
}
