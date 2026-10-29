/**
 * A deploy replaces every hashed file under `/assets/`, so a tab opened before
 * it still holds an `index-*.js` whose lazy chunks no longer exist. The next
 * navigation to a page not visited yet fails with "Failed to fetch dynamically
 * imported module" and the view simply never renders. A full page load
 * fetches the current `index.html` (served `no-cache`) and with it the
 * current chunk names, which is the whole fix.
 */

const STALE_CHUNK_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/** Chrome, Firefox and Safari word the failed dynamic import differently. */
export function isStaleChunkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return STALE_CHUNK_RE.test(message)
}

export const RELOAD_KEY = 'stale_chunk_reload_at'
const RELOAD_COOLDOWN_MS = 10_000

/**
 * Whether to reload now, recording the attempt. A chunk that is missing for
 * some other reason (a half-finished deploy, a Caddy route gone wrong) is
 * still missing after the reload, so without the cooldown the page would
 * reload forever. Storage that throws — a private window, blocked site data,
 * where even reading `window.sessionStorage` raises — means no reload rather
 * than an unguarded one; hence a getter, called inside the `try`.
 *
 * A stored time in the future (the clock was set back) is ignored rather
 * than read as "just reloaded", which would block reloads until the clock
 * caught up.
 */
export function claimReload(
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'>,
  now: number,
): boolean {
  try {
    const storage = getStorage()
    const last = Number(storage.getItem(RELOAD_KEY))
    if (last && now >= last && now - last < RELOAD_COOLDOWN_MS) return false
    storage.setItem(RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}
