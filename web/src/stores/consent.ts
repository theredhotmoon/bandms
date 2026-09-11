import { atom } from 'nanostores'

/**
 * Cookie-consent state shared across the banner island and the footer's
 * "Cookie settings" link — two separate Astro islands, so this is the channel
 * between them, the same way `booking.ts` connects the availability calendar
 * to the contact form.
 *
 * 'unknown' means the banner should be showing; GA is only ever loaded from
 * 'granted', never on page load for an undecided visitor — see
 * `src/lib/analytics.ts`.
 */
export type ConsentStatus = 'unknown' | 'granted' | 'denied'

const STORAGE_KEY = 'bandms:consent'

interface StoredConsent {
  status: 'granted' | 'denied'
  /** ISO timestamp of the decision, so a stale choice can expire — see resolveStoredConsent(). */
  decidedAt: string
}

export const consentStatus = atom<ConsentStatus>('unknown')

function readStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.status === 'granted' || parsed?.status === 'denied'
      ? (parsed as StoredConsent)
      : null
  } catch {
    // Corrupt JSON, or storage unavailable (private mode, quota) — treat as no decision.
    return null
  }
}

function writeStoredConsent(status: 'granted' | 'denied'): void {
  try {
    const value: StoredConsent = { status, decidedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Choice just won't persist across reloads — the banner reappears, which is safe.
  }
}

/**
 * A stored Accept/Reject isn't honoured forever — EU regulators generally
 * expect a site to ask again after some period; French CNIL guidance points
 * to 6 months, which is the default here. This is a product/legal call more
 * than a technical one — tune it if this project's guidance differs.
 */
const CONSENT_VALID_MS = 1000 * 60 * 60 * 24 * 30 * 6

/**
 * Decides what a stored choice is worth right now: 'unknown' if there's no
 * stored choice or it has expired (the banner should reappear), otherwise the
 * stored 'granted'/'denied' verdict.
 */
export function resolveStoredConsent(stored: StoredConsent | null): ConsentStatus {
  if (!stored) return 'unknown'
  const decidedAt = Date.parse(stored.decidedAt)
  if (Number.isNaN(decidedAt) || Date.now() - decidedAt > CONSENT_VALID_MS) return 'unknown'
  return stored.status
}

/** Reads localStorage and sets the atom accordingly. Call once, on mount. */
export function loadStoredConsent(): void {
  consentStatus.set(resolveStoredConsent(readStoredConsent()))
}

export function grantConsent(): void {
  writeStoredConsent('granted')
  consentStatus.set('granted')
}

export function denyConsent(): void {
  writeStoredConsent('denied')
  consentStatus.set('denied')
}

/** Reopens the banner — the footer's "Cookie settings" link, so withdrawing consent is as easy as giving it. */
export function resetConsent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage was never reachable.
  }
  consentStatus.set('unknown')
}
