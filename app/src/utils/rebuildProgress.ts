import type { RebuildStatus } from '@/types/website-module'

/**
 * The progress line on the admin's rebuild bar.
 *
 * The rebuild webhook reports only a state and two timestamps, never a real
 * percentage, so progress is an estimate from elapsed time — the same idea as
 * the Website-modules bar #99 removed. It runs linearly to 90% at the expected
 * build time and then creeps toward 99% instead of stopping, so a slow build
 * still visibly moves; only `done`/`error` reach 100%.
 */

/** Roughly how long a public-site rebuild takes on the server. */
export const EXPECTED_BUILD_MS = 60_000
/** How long the green "done" line stays up after a build finishes. */
export const DONE_VISIBLE_MS = 4_000
/** A failure stays up longer: it is the one result that needs reading. */
export const ERROR_VISIBLE_MS = 30_000

export interface RebuildProgress {
  visible: boolean
  percent: number
  tone: 'building' | 'done' | 'error'
}

export function rebuildProgress(
  status: Pick<RebuildStatus, 'status' | 'startedAt' | 'finishedAt'>,
  now: number,
): RebuildProgress {
  if (status.status === 'building') {
    const elapsed = status.startedAt ? Math.max(0, now - status.startedAt) : 0
    const linear = (elapsed / EXPECTED_BUILD_MS) * 90
    // Past the expected time, close half the remaining gap to 99% per expected period.
    const overtime = (elapsed - EXPECTED_BUILD_MS) / EXPECTED_BUILD_MS
    const percent = elapsed <= EXPECTED_BUILD_MS ? linear : 99 - 9 * Math.pow(0.5, overtime)
    return { visible: true, percent, tone: 'building' }
  }

  if ((status.status === 'done' || status.status === 'error') && status.finishedAt) {
    const since = now - status.finishedAt
    const window = status.status === 'done' ? DONE_VISIBLE_MS : ERROR_VISIBLE_MS
    if (since >= 0 && since <= window) return { visible: true, percent: 100, tone: status.status }
  }

  return { visible: false, percent: 0, tone: 'building' }
}
