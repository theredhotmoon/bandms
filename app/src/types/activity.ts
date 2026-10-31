export type ActivityAction = 'created' | 'updated' | 'deleted' | 'other'

/** `{attribute: [old, new]}`. Values are raw column values; JSON columns arrive decoded. */
export type ActivityDiff = Record<string, [unknown, unknown]>

/** One Eloquent write inside an activity entry. */
export interface ActivityChange {
  id: number
  event: Exclude<ActivityAction, 'other'>
  /** Model class basename, e.g. `Post`, `BandMember`. */
  subject_type: string
  subject_id: number | null
  /** Snapshot taken at the time — still set after the record is deleted. */
  subject_label: string | null
  diff: ActivityDiff
}

/** One request (or background job) that changed something. */
export interface ActivityEntry {
  id: number
  created_at: string
  user_id: number | null
  /** Snapshot; null means a visitor or the system (a job, a command). */
  user_name: string | null
  action: ActivityAction
  method: string | null
  route: string | null
  subject_type: string | null
  subject_id: number | null
  subject_label: string | null
  changes: ActivityChange[]
}

export interface ActivityPage {
  data: ActivityEntry[]
  meta: { current_page: number; last_page: number; total: number; per_page: number }
}

export interface ActivityFilterOptions {
  subject_types: string[]
  users: { id: number; name: string | null }[]
}

export interface ActivityFilters {
  subject_type: string | null
  subject_id: number | null
  user_id: number | null
  action: ActivityAction | null
  from: string | null
  to: string | null
  q: string | null
  page: number
}
