/** What the crawler found: news about ska, a mention of the band, or a lead to contact. */
export type FindingKind = 'mention' | 'news' | 'lead'
/** `snoozed` is "Not now": back to `new` on its own once `snoozed_until` passes. */
export type FindingStatus = 'new' | 'saved' | 'dismissed' | 'snoozed'
export type LeadType = 'venue' | 'promoter' | 'festival' | 'band' | 'media' | 'profile'

/** One row of GET /api/admin/assistant/findings. */
export interface Finding {
  id: number
  kind: FindingKind
  source: string
  url: string
  title: string
  snippet: string
  country: string | null
  lead_type: LeadType | null
  score: number
  status: FindingStatus
  /** When a snoozed finding comes back to the inbox. */
  snoozed_until: string | null
  /** What "Wrong → block the whole site" would block — null when nothing can be (a post link, a Maps link). */
  site: { key: string; label: string } | null
  /** Triage's one-line summary — null until triage (slice 3) has read it. */
  summary: string | null
  saved_type: string | null
  saved_id: number | null
  found_at: string | null
  /** A record the band already has with this name (triage) — no Save as… then. */
  known: { type: 'venue' | 'band' | 'author'; id: number; name: string } | null
  /** The id of the finding that found this page first (triage). */
  duplicate_of: number | null
  /** What triage read off the finding — Save as… prefills from it. */
  contacts: { email?: string | null; website?: string | null; instagram?: string | null; facebook?: string | null } | null
}

export interface FindingsFilter {
  kind: FindingKind | null
  country: string | null
  status: FindingStatus
  q: string
  page: number
}

/** The lengths "Not now" offers, in months. */
export type SnoozeMonths = 1 | 3 | 6

/** What PATCH /findings/{id} takes: restore, Not now, or Wrong (optionally blocking the site). */
export type FindingStatusChange =
  | { status: 'new' }
  | { status: 'snoozed'; snooze_months: SnoozeMonths }
  | { status: 'dismissed'; block_site?: boolean }

export interface FindingStatusResult {
  data: Finding
  meta: { blocked: { key: string; label: string } | null; also_dismissed: number }
}

/** One row of GET /api/admin/assistant/blocked-sites. */
export interface BlockedSite {
  id: number
  key: string
  label: string
  created_by: string | null
  created_at: string
}

/** The list plus the counts the chips show — each within the other filters. */
export interface FindingsPage {
  data: Finding[]
  meta: {
    countries: Record<string, number>
    kinds: Partial<Record<FindingKind, number>>
    total: number
    page: number
    last_page: number
  }
}

export type RunStatus = 'ok' | 'capped' | 'failed'

export interface CrawlRun {
  source: string
  status: RunStatus | null
  started_at: string | null
  finished_at: string | null
  queries: number
  found?: number
  new: number
  error: string | null
  /** What is left of today's cap (GET /runs only). */
  remaining?: number
  /** How many of the latest runs failed in a row (GET /runs only). */
  failing_runs?: number
}

/** POST /api/admin/assistant/run's answer. */
export interface CrawlDispatch {
  queued: string[]
  skipped: Record<string, string>
}

export interface SourceSettings {
  enabled: boolean
  cap_day: number
  cap_month?: number
}

/** The stored settings, as GET/PUT /api/admin/assistant/settings `data`. */
export interface CrawlerSettings {
  keywords: string[]
  countries: string[]
  cities_by_country: Record<string, string[]>
  sources: Record<string, SourceSettings>
  rss_feeds: string[]
  sibling_bands: { mbid: string; name: string }[]
  digest_to: string[]
}

/** One source as the settings page shows it: whether its key is in env, its last run. */
export interface SourceStatus {
  key: string
  enabled: boolean
  hasKey: boolean
  /** False for a source planned but not built yet — its settings exist, it never runs. */
  available: boolean
  cap_day: number
  cap_month: number | null
  lastRun: Omit<CrawlRun, 'source' | 'found'> | null
}

export interface CrawlerSettingsResponse {
  data: CrawlerSettings
  sources: SourceStatus[]
  countries: { code: string; name: string; native: string }[]
}

/** GET /api/admin/assistant/summary — the dashboard widget. */
export interface AssistantSummary {
  new: Record<FindingKind, number>
  last_run_at: string | null
  failing_sources: number
}
