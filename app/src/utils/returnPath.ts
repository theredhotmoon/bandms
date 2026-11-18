/**
 * Where a fan sign-in link may send the fan afterwards: a path on this site,
 * nothing else. `//host` and `/\host` are protocol-relative URLs to a browser,
 * so a leading slash alone is not enough.
 *
 * Mirrors App\Support\ReturnPath (API) and cleanReturnPath in
 * web/src/lib/comments.ts — the three must agree, and this one is the last
 * line: the value arrives in a URL anyone can hand-craft.
 */
export const RETURN_PATH_MAX = 300

export function cleanReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value === '' || value.length > RETURN_PATH_MAX) return null
  if (value[0] !== '/' || value.startsWith('//') || value.includes('\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(value)) return null
  return value
}

/** Where the comments block notes the path a sign-in link was asked from. */
export const RETURN_KEY = 'fan_return_to'

type ReturnStore = Pick<Storage, 'getItem' | 'removeItem'>

/**
 * The path to go back to after sign-in: the link's `return`, but only when
 * this browser asked for it (the comments block stored the same path under
 * RETURN_KEY). The note is used once.
 *
 * Without the match a sign-in link signs its opener in and forwards them
 * without a pause — so an attacker's own link, sent to someone else, would
 * leave that person commenting under the attacker's account without ever
 * seeing the account page. A browser that did not ask stays on /account.
 */
export function consumeReturnPath(fromLink: unknown, store: ReturnStore | null): string | null {
  const wanted = cleanReturnPath(fromLink)
  let asked: string | null = null
  try {
    asked = store?.getItem(RETURN_KEY) ?? null
    store?.removeItem(RETURN_KEY)
  } catch {
    return null
  }
  return wanted !== null && wanted === asked ? wanted : null
}
