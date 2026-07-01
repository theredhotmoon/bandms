export interface WebsiteModule {
  slug: string
  display_name: string
  enabled: boolean
  sort_order: number
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
