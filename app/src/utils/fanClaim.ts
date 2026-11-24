/**
 * The "claim" that ties a password registration to the browser that made it.
 *
 * A random value stays in this browser; its SHA-256 goes to the server with
 * the registration, and the browser presents the value itself when the emailed
 * link is opened. Same key and contract as web/src/lib/fanAuth.ts — the public
 * site registers, this page exchanges the link.
 */
export const CLAIM_KEY = 'fan_claim'

type ClaimStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Makes a fresh claim, keeps it under CLAIM_KEY and resolves to its SHA-256
 * (hex). Null — with nothing changed — when storage, randomness or hashing is
 * unavailable: the registration then goes without a claim.
 */
export async function newClaim(store: ClaimStore | null): Promise<string | null> {
  if (!store) return null
  try {
    const claim = toHex(crypto.getRandomValues(new Uint8Array(32)))
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(claim)) // i18n-ignore: WebCrypto algorithm name
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
 * kept. Same rule in web/src/lib/fanAuth.ts.
 */
export async function withNewClaim<T>(
  store: ClaimStore | null,
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

function readClaim(store: ClaimStore | null): string | null {
  try {
    return store?.getItem(CLAIM_KEY) ?? null
  } catch {
    return null
  }
}

/** Only while the claim is still the one issued: another tab may have registered since. */
function undoClaim(store: ClaimStore | null, issued: string, previous: string | null): void {
  try {
    if (store?.getItem(CLAIM_KEY) !== issued) return
    if (previous === null) store.removeItem(CLAIM_KEY)
    else store.setItem(CLAIM_KEY, previous)
  } catch {
    // Not put back: the earlier link still signs the fan in, without the password.
  }
}

/**
 * Puts a consumed claim back after an exchange that did not use the link up, so
 * opening it again can still activate the password. A claim stored in
 * the meantime belongs to a newer registration and wins.
 */
export function restoreClaim(store: ClaimStore | null, claim: string | null): void {
  if (!claim) return
  try {
    if (store && store.getItem(CLAIM_KEY) === null) store.setItem(CLAIM_KEY, claim)
  } catch {
    // Not kept: the link still signs the fan in, without the password.
  }
}

/** The stored claim, removed as it is read — a claim is used once. */
export function consumeClaim(store: Pick<Storage, 'getItem' | 'removeItem'> | null): string | null {
  try {
    const claim = store?.getItem(CLAIM_KEY) ?? null
    store?.removeItem(CLAIM_KEY)
    return claim || null
  } catch {
    return null
  }
}
