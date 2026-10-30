/**
 * The Translate button's one rule: an empty field fills on a click; a filled
 * one is only REPLACED by a second click inside the confirm window. Pure, so
 * the window's edges are testable without a DOM; TranslatedField.vue owns the
 * clock and the armed state.
 */

/** How long the first press on a filled field keeps the button in confirm state. */
export const CONFIRM_MS = 3000

/** Which row is armed, and until when (ms, same clock as `now`). */
export interface Armed {
  key: string
  until: number
}

export type ClickDecision = { action: 'translate' } | { action: 'arm'; until: number }

/**
 * Whether a reply may still land. The row stays editable while the request
 * runs, and a host may swap the bag under a mounted field (a reordered post
 * block, a reloaded record) — so the answer lands only if the target still
 * holds what it held at click time AND the source still reads what was sent.
 * Either moving means this row is no longer the one that asked.
 */
export function replyStillApplies(
  sent: { target: string; source: string },
  now: { target: string; source: string },
): boolean {
  return now.target === sent.target && now.source === sent.source
}

export function decideClick(input: {
  filled: boolean
  armed: Armed | null
  key: string
  now: number
}): ClickDecision {
  const { filled, armed, key, now } = input
  if (!filled) return { action: 'translate' }
  if (armed && armed.key === key && now <= armed.until) return { action: 'translate' }
  return { action: 'arm', until: now + CONFIRM_MS }
}
