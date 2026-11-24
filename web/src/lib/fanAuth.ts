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
