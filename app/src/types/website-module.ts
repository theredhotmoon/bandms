export interface WebsiteModule {
  slug: string
  display_name: string
  custom_name: { en: string | null; pl: string | null }
  /** Per-locale URL segment. null means "serve under `slug`". */
  custom_slug: { en: string | null; pl: string | null }
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
