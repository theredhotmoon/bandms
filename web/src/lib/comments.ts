/**
 * Comments under a news post — everything the PostComments island needs that
 * is not markup: the fan session it shares with the account page, the API
 * calls, and the sign-in return path.
 *
 * Comments are read and written in the browser, never at build time, so a
 * comment needs no site rebuild.
 */

export interface PostComment {
  id: number
  author_name: string
  body: string
  created_at: string
  /** True when the signed-in fan wrote it — the page then offers Delete. */
  mine: boolean
}

export interface CommentsResponse {
  data: PostComment[]
  /** False when comments were switched off for the post after the last build. */
  enabled: boolean
}

export interface FanProfile {
  id: number
  email: string
  name: string
  display_name?: string | null
  comments_blocked?: boolean
}

export interface FanSession {
  token: string
  fan: FanProfile
}

/** An API answer the island can show: the server's own (localised) message. */
export class CommentApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields: Record<string, string[]> = {},
    /** Set by the API when the message is its own, worded for the fan (`comment_limit`). */
    public readonly code: string | null = null,
  ) {
    super(message)
  }
}

export const COMMENT_MAX = 2000
export const NAME_MAX = 50
const RETURN_PATH_MAX = 300

/**
 * A path on this site, or null. `//host` and `/\host` are protocol-relative to
 * a browser, so a leading slash alone is not enough. Mirrors
 * App\Support\ReturnPath and app/src/utils/returnPath.ts.
 */
export function cleanReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value === '' || value.length > RETURN_PATH_MAX) return null
  if (value[0] !== '/' || value.startsWith('//') || value.includes('\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(value)) return null
  return value
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Storage blocked (private mode, site data off): the visitor is signed out.
    return null
  }
}

/**
 * The fan session the account page (the admin SPA's /account) stores under
 * `fan_token` + `fan`. Same origin, so this page reads the same keys. Anything
 * missing or malformed is "signed out", never an error.
 */
export function readFanSession(store: Store | null = browserStore()): FanSession | null {
  if (!store) return null
  try {
    const token = store.getItem('fan_token')
    const raw = store.getItem('fan')
    if (!token || !raw) return null
    const fan = JSON.parse(raw) as Partial<FanProfile> | null
    if (!fan || typeof fan.id !== 'number' || typeof fan.email !== 'string') return null
    return { token, fan: fan as FanProfile }
  } catch {
    return null
  }
}

/** Keeps the stored profile current, so the account page sees a new display name too. */
export function storeFan(fan: FanProfile, store: Store | null = browserStore()): void {
  try {
    store?.setItem('fan', JSON.stringify(fan))
  } catch {
    // Not persisted; the page still holds it for this visit.
  }
}

export function clearFanSession(store: Store | null = browserStore()): void {
  try {
    store?.removeItem('fan_token')
    store?.removeItem('fan')
  } catch {
    // Nothing to clear.
  }
}

/**
 * Notes, in this browser, that a sign-in link was asked for from `path`.
 *
 * The account page follows the link's `return` only when it finds the same
 * path here. Without that, a sign-in link is a quiet way to sign someone else
 * into YOUR account: send them `/account?token=…&return=/en/news/x` and they
 * land on an article already signed in as you, never having seen the account
 * page. A browser that did not ask stops on /account, as it always did.
 */
export const RETURN_KEY = 'fan_return_to'

export function rememberReturnPath(path: string, store: Store | null = browserStore()): void {
  const clean = cleanReturnPath(path)
  if (!clean) return
  try {
    store?.setItem(RETURN_KEY, clean)
  } catch {
    // Not remembered: the fan lands on the account page instead. No harm.
  }
}

export function formatCommentDate(iso: string, lang: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(date)
}

function headers(lang: string, token?: string | null, json = false): Record<string, string> {
  return {
    Accept: 'application/json',
    // The fan API answers in this language (SetLocale) — the page's, not the browser's.
    'Accept-Language': lang,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // No JSON body; the caller's own fallback wording is the better answer.
  }
  if (res.ok) return body as T

  const { message, errors, code } = (body ?? {}) as { message?: string; errors?: Record<string, string[]>; code?: string }
  const first = errors ? Object.values(errors)[0]?.[0] : undefined
  throw new CommentApiError(res.status, first ?? message ?? '', errors ?? {}, typeof code === 'string' ? code : null)
}

export async function fetchComments(postId: number, lang: string, token?: string | null): Promise<CommentsResponse> {
  return parse<CommentsResponse>(await fetch(`/api/posts/${postId}/comments`, { headers: headers(lang, token) }))
}

export async function postComment(
  postId: number,
  lang: string,
  token: string,
  payload: { body: string; display_name?: string },
): Promise<PostComment> {
  const res = await fetch(`/api/fan/posts/${postId}/comments`, {
    method: 'POST',
    headers: headers(lang, token, true),
    body: JSON.stringify(payload),
  })
  return (await parse<{ data: PostComment }>(res)).data
}

export async function deleteComment(id: number, lang: string, token: string): Promise<void> {
  await parse<void>(await fetch(`/api/fan/comments/${id}`, { method: 'DELETE', headers: headers(lang, token) }))
}

export async function fetchFanProfile(lang: string, token: string): Promise<FanProfile> {
  return parse<FanProfile>(await fetch('/api/fan/me', { headers: headers(lang, token) }))
}

export async function saveDisplayName(lang: string, token: string, displayName: string): Promise<FanProfile> {
  const res = await fetch('/api/fan/me', {
    method: 'PUT',
    headers: headers(lang, token, true),
    body: JSON.stringify({ display_name: displayName }),
  })
  return parse<FanProfile>(res)
}

export async function requestSignInLink(email: string, lang: string, returnTo: string): Promise<void> {
  const res = await fetch('/api/fan/auth/magic-link', {
    method: 'POST',
    headers: headers(lang, null, true),
    body: JSON.stringify({ email, return_to: cleanReturnPath(returnTo) }),
  })
  await parse<unknown>(res)
}
