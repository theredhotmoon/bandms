import type { ActivityAction, ActivityFilters } from '@/types/activity'

const ACTIONS: readonly ActivityAction[] = ['created', 'updated', 'deleted', 'other']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TYPE = /^[A-Za-z][A-Za-z0-9]{0,63}$/

type RawQuery = Record<string, unknown>

function str(v: unknown): string | null {
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && s.trim() !== '' ? s.trim() : null
}

function id(v: unknown): number | null {
  const s = str(v)
  return s !== null && /^\d{1,10}$/.test(s) && Number(s) > 0 ? Number(s) : null
}

/**
 * The page's filters live in the URL, so "history of this post" is a link
 * (`?subject_type=Post&subject_id=12`). Anything malformed is dropped rather
 * than sent: the query string is user-editable.
 */
export function parseActivityFilters(query: RawQuery): ActivityFilters {
  const type   = str(query.subject_type)
  const action = str(query.action)
  const from   = str(query.from)
  const to     = str(query.to)
  const subjectType = type && TYPE.test(type) ? type : null

  return {
    subject_type: subjectType,
    // An id without a type would match every entity with that id.
    subject_id:   subjectType ? id(query.subject_id) : null,
    user_id:      id(query.user_id),
    action:       action && (ACTIONS as readonly string[]).includes(action) ? action as ActivityAction : null,
    from:         from && DATE.test(from) ? from : null,
    to:           to && DATE.test(to) ? to : null,
    q:            str(query.q)?.slice(0, 100) ?? null,
    page:         id(query.page) ?? 1,
  }
}

/** Only the filters that are set, as strings — for the URL and the API alike. */
export function activityQueryParams(filters: ActivityFilters): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === '') continue
    if (key === 'page' && value === 1) continue
    out[key] = String(value)
  }
  return out
}

/**
 * One diff value as short text. Translation bags (`{en: …, pl: …}`) read per
 * locale; other structures fall back to JSON. `empty` is what null prints as.
 */
export function formatDiffValue(value: unknown, empty: string): string {
  if (value === null || value === undefined || value === '') return empty
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (isLocaleBag(value)) {
    const parts = Object.entries(value)
      .filter(([, v]) => v !== null && v !== '')
      .map(([k, v]) => `${k}: ${String(v)}`)
    return parts.length ? parts.join(' · ') : empty
  }
  // A list (a post's blocks) reads one item per line; the cell keeps newlines.
  if (Array.isArray(value)) {
    if (value.length === 0) return empty
    return value.map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))).join('\n')
  }
  return JSON.stringify(value)
}

function isLocaleBag(value: unknown): value is Record<string, string | null> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.entries(value)
  return entries.length > 0
    && entries.every(([k, v]) => /^[a-z]{2}(-[A-Z]{2})?$/.test(k) && (v === null || typeof v === 'string'))
}

/** `BandMember` → `Band member`. Entity names are data, not catalogue copy. */
export function humanizeType(type: string): string {
  const spaced = type.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
