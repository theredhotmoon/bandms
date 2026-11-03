import type { ActivityAction, ActivityDiff } from '@/types/activity'
import { ACTIVITY_ACTIONS } from '@/utils/activityFilters'

/** One logged edit a rebuild made live — a snapshot taken when it ran. */
export interface RebuildIncludedChange {
  log_id: number
  at: string | null
  user: string | null
  action: ActivityAction
  subject_type: string | null
  subject_id: number | null
  subject_label: string | null
}

export interface RebuildDetails {
  trigger: 'manual' | 'auto'
  /** Pending areas the rebuild shipped (`concerts`, `band-profile`…). */
  areas: string[]
  /**
   * Edits logged since the previous rebuild. `null` for an automatic one,
   * which is filed under the save that fired it and lists nothing else.
   */
  changes: RebuildIncludedChange[] | null
  /** How many edits there were; above `changes.length` when the list was capped. */
  changesTotal: number
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null
}

function toChange(raw: unknown): RebuildIncludedChange | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const logId = num(r.log_id)
  if (logId === null) return null
  const action = str(r.action)
  return {
    log_id: logId,
    at: str(r.at),
    user: str(r.user),
    action: action && (ACTIVITY_ACTIONS as readonly string[]).includes(action) ? action as ActivityAction : 'other',
    subject_type: str(r.subject_type),
    subject_id: num(r.subject_id),
    subject_label: str(r.subject_label),
  }
}

/**
 * Read a `rebuilt` change's diff (`{trigger, areas, changes}`, each stored as
 * `[null, value]`). The log is history, so anything malformed is dropped
 * rather than thrown: an entry from a later shape must still render.
 */
export function parseRebuildDiff(diff: ActivityDiff): RebuildDetails {
  const after = (key: string): unknown => diff[key]?.[1]

  const areas = after('areas')
  const rawChanges = after('changes')
  const changes = Array.isArray(rawChanges)
    ? rawChanges.map(toChange).filter((c): c is RebuildIncludedChange => c !== null)
    : null
  const total = num(after('changes_total'))

  return {
    trigger: after('trigger') === 'auto' ? 'auto' : 'manual',
    areas: Array.isArray(areas) ? areas.filter((a): a is string => typeof a === 'string' && a !== '') : [],
    changes,
    changesTotal: Math.max(total ?? 0, changes?.length ?? 0),
  }
}
