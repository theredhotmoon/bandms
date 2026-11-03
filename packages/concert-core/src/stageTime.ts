/** The two times a concert carries that can say when our band plays. */
export interface StageTimeSource {
  start_time: string | null
  own_play_time?: string | null
}

export interface StageTime {
  /** As stored (`HH:mm` or `HH:mm:ss`), or null when the concert has neither. */
  time: string | null
  /** True when `time` is the show's start, standing in for an unset slot. */
  fallback: boolean
}

/**
 * When our band is on stage: its own slot (`own_play_time`), else the show's
 * start.
 *
 * `start_time` is when the night starts — the opener's slot whenever we
 * headline — so it is only our time when nothing more specific was set,
 * which is every concert saved before `own_play_time` existed. The public
 * show page prints this under "On stage" and the admin's concerts list shows
 * it with a borrowed start dimmed; both read it here, so they cannot drift.
 *
 * An empty string counts as unset, the way a cleared time input arrives.
 */
export function resolveStageTime(concert: StageTimeSource): StageTime {
  if (concert.own_play_time) return { time: concert.own_play_time, fallback: false }
  if (concert.start_time) return { time: concert.start_time, fallback: true }
  return { time: null, fallback: false }
}

/** Just the time from `resolveStageTime()`, for callers that print it. */
export function ourStageTime(concert: StageTimeSource): string | null {
  return resolveStageTime(concert).time
}
