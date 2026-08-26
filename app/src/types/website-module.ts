/** A value carried per supported locale. */
export type Localized = { en: string | null; pl: string | null }

/** The editable fields of a module, as accepted by PUT /api/admin/modules/{slug}. */
export interface WebsiteModuleSettingsPayload {
  custom_name?: Localized
  /** Omitting a locale leaves it untouched; an explicit null clears it. */
  custom_slug?: Localized
  per_page?: number | null
}

export interface WebsiteModule {
  slug: string
  display_name: string
  custom_name: Localized
  /** Per-locale URL segment. null means "serve under `slug`". */
  custom_slug: Localized
  enabled: boolean
  sort_order: number
  per_page: number | null
  updated_at: string
}

export interface WebsiteModulesResponse {
  data: WebsiteModule[]
  auto_rebuild: boolean
}

export interface SiteSettings {
  auto_rebuild: boolean
}

export interface RebuildStatus {
  status: 'idle' | 'building' | 'done' | 'error' | 'unknown'
  startedAt: number | null
  finishedAt: number | null
}
