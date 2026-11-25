/**
 * Password sign-in and registration for fans, plus the "claim".
 *
 * The claim is a random value this browser keeps; its SHA-256 goes to the
 * server with the registration, and the browser presents the value itself when
 * the emailed link is opened. Without it, anyone could plant a password on
 * someone else's account by registering their address. The admin SPA's
 * /account page reads the same storage key.
 *
 * There is one claim per browser, so a second registration replaces the first
 * one's (unless it is refused): only the link in the newest mail can activate
 * its password. An older link still signs the fan in, without one.
 */
import {
  CommentApiError, browserStore, cleanReturnPath, headers, parse, storeSession,
  type FanSession, type Store,
} from './comments'

export const CLAIM_KEY = 'fan_claim'

/** What a provider button replaced: see newProviderClaim(). */
export const KEPT_CLAIM_KEY = 'fan_claim_kept'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Makes a fresh claim, keeps it under CLAIM_KEY and resolves to its SHA-256
 * (hex). Null — with nothing changed — when storage, randomness or hashing is
 * unavailable: the registration then goes without a claim.
 */
export async function newClaim(store: Store | null = browserStore()): Promise<string | null> {
  if (!store) return null
  try {
    const claim = toHex(crypto.getRandomValues(new Uint8Array(32)))
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(claim))
    store.setItem(CLAIM_KEY, claim)
    return toHex(new Uint8Array(digest))
  } catch {
    return null
  }
}

/**
 * A fresh claim for a provider sign-in. Most of those end without using it, so
 * the claim it replaces (a registration's mail may still need it) is kept aside
 * beside the value that replaced it. Pressing again keeps what the first press
 * kept, never the first press's own. Same rule and same entry in
 * app/src/utils/fanClaim.ts, where /account puts it back or drops it.
 */
export async function newProviderClaim(store: Store | null = browserStore()): Promise<string | null> {
  const previous = readClaim(store)
  const kept = readKept(store)
  const claimHash = await newClaim(store)
  const own = claimHash === null ? null : readClaim(store)
  if (own === null) return claimHash
  const earlier = kept !== null && kept.own === previous ? kept.earlier : previous
  try {
    store?.setItem(KEPT_CLAIM_KEY, JSON.stringify({ own, earlier }))
  } catch {
    // Not kept: the earlier link still signs the fan in, without the password.
  }
  return claimHash
}

function readKept(store: Store | null): { own: string; earlier: string | null } | null {
  try {
    const kept = JSON.parse(store?.getItem(KEPT_CLAIM_KEY) ?? 'null') as { own?: unknown; earlier?: unknown } | null
    if (typeof kept?.own !== 'string') return null
    return { own: kept.own, earlier: typeof kept.earlier === 'string' ? kept.earlier : null }
  } catch {
    return null
  }
}

/**
 * Registers with a fresh claim. A registration the server refused mailed
 * nothing, so the claim the earlier mail needs is put back. With no answer, or
 * a gateway's, it is not known whether a mail went out, and the new claim is
 * kept. Same rule in app/src/utils/fanClaim.ts.
 */
export async function withNewClaim<T>(
  store: Store | null,
  register: (claimHash: string | null) => Promise<T>,
  refused: (err: unknown) => boolean,
): Promise<T> {
  const previous = readClaim(store)
  const claimHash = await newClaim(store)
  const issued = claimHash === null ? null : readClaim(store)
  try {
    return await register(claimHash)
  } catch (err) {
    if (issued !== null && refused(err)) undoClaim(store, issued, previous)
    throw err
  }
}

function readClaim(store: Store | null): string | null {
  try {
    return store?.getItem(CLAIM_KEY) ?? null
  } catch {
    return null
  }
}

/** Only while the claim is still the one issued: another tab may have registered since. */
function undoClaim(store: Store | null, issued: string, previous: string | null): void {
  try {
    if (store?.getItem(CLAIM_KEY) !== issued) return
    if (previous === null) store.removeItem(CLAIM_KEY)
    else store.setItem(CLAIM_KEY, previous)
  } catch {
    // Not put back: the earlier link still signs the fan in, without the password.
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
  lang: string,
  store: Store | null = browserStore(),
): Promise<FanSession> {
  const res = await fetch('/api/fan/auth/login', {
    method: 'POST',
    headers: headers(lang, null, true),
    body: JSON.stringify({ email, password }),
  })
  const session = await parse<FanSession>(res)
  const { token, fan } = session
  storeSession({ token, fan }, store)
  return { token, fan }
}

export async function registerWithPassword(
  email: string,
  password: string,
  lang: string,
  returnTo: string,
  store: Store | null = browserStore(),
): Promise<void> {
  await withNewClaim(store, async (claimHash) => {
    const res = await fetch('/api/fan/auth/register', {
      method: 'POST',
      headers: headers(lang, null, true),
      body: JSON.stringify({
        email,
        password,
        ...(claimHash ? { claim_hash: claimHash } : {}),
        return_to: cleanReturnPath(returnTo),
      }),
    })
    await parse<unknown>(res)
  }, serverRefused)
}

/**
 * The API answered with an error status. A gateway's 502 or 504 is not its
 * answer: the request may have gone through. Same rule in the SPA's fanErrors.ts.
 */
function serverRefused(err: unknown): boolean {
  return err instanceof CommentApiError && err.status !== 502 && err.status !== 504
}

/**
 * What the sign-in form shows for a failed request. Two codes the API sets get
 * the band's own wording; a 422 is shown as the API wrote it (validation, in
 * the page's language); everything else — a throttle, a 5xx, the network —
 * carries a framework string in English and is never shown.
 */
export function fanAuthErrorText(
  e: unknown,
  copy: { loginFailed: string; loginLimit: string; failed: string },
): string {
  if (e instanceof CommentApiError) {
    if (e.code === 'login_failed') return copy.loginFailed
    if (e.code === 'login_limit') return copy.loginLimit
    if (e.status === 422 && e.message) return e.message
  }
  return copy.failed
}

/**
 * The sign-in providers the site knows how to present, by the name the API
 * uses. Anything else the API lists is ignored, never rendered: a button needs
 * a name and a mark, and a provider added server-side first has neither.
 */
const PROVIDER_NAMES: Readonly<Record<string, string>> = { google: 'Google', facebook: 'Facebook' }

/** The proper name shown on a button; '' for a provider the site does not present. */
export function providerName(provider: string): string {
  return Object.hasOwn(PROVIDER_NAMES, provider) ? PROVIDER_NAMES[provider] : ''
}

/**
 * Which providers the API has configured, in its order. Empty on any failure —
 * a broken endpoint must never break the form around it.
 */
export async function fetchProviders(lang: string): Promise<string[]> {
  try {
    const res = await fetch('/api/fan/auth/providers', { headers: headers(lang, null, false) })
    if (!res.ok) return []
    const body = (await res.json()) as { providers?: unknown }
    if (!Array.isArray(body.providers)) return []
    return body.providers.filter(
      (p): p is string => typeof p === 'string' && Object.hasOwn(PROVIDER_NAMES, p),
    )
  } catch {
    return []
  }
}

/** The address a provider button points at. A claim is optional; so is a usable return path. */
export function providerUrl(
  provider: string,
  lang: string,
  returnTo: string,
  claimHash: string | null,
): string {
  const params = [`lang=${encodeURIComponent(lang)}`]
  const path = cleanReturnPath(returnTo)
  if (path) params.push(`return_to=${encodeURIComponent(path)}`)
  if (claimHash) params.push(`claim_hash=${encodeURIComponent(claimHash)}`)
  return `/api/fan/auth/${encodeURIComponent(provider)}/redirect?${params.join('&')}`
}

/** A click the page handles itself; a modified or middle click is the browser's (new tab, download…). */
export function isPlainLeftClick(
  e: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
