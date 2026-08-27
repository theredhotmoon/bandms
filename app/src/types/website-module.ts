/** A value carried per supported locale. */
export type Localized = { en: string | null; pl: string | null }

/**
 * Editable page copy, keyed by field then locale.
 *
 * A generic bag rather than named fields: which fields a module has is decided
 * by MODULE_SETTINGS_SCHEMA on the client and by nothing at all on the server,
 * so adding a field to a module needs no migration.
 */
export type ModuleSettings = Record<string, Partial<Localized>>

/** The editable fields of a module, as accepted by PUT /api/admin/modules/{slug}. */
export interface WebsiteModuleSettingsPayload {
  custom_name?: Localized
  /** Omitting a locale leaves it untouched; an explicit null clears it. */
  custom_slug?: Localized
  per_page?: number | null
  /**
   * Merged per field and per locale by the API. Omitting a locale leaves it
   * untouched; an explicit null clears just that one.
   */
  settings?: ModuleSettings
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
  /**
   * Both locales, as stored. The API serves `{}` when a module has no copy, so
   * this is never null — but a field inside it may be missing either locale.
   */
  settings: ModuleSettings
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
