import type { BandContact } from '@/types/band'

/**
 * A band pitch is addressed to a *person* but talks about their *band*, and
 * those are two different names. Kept here rather than in the view so it can
 * be unit-tested: the admin's vitest environment is `node`, and anything that
 * reaches useAuth (and therefore localStorage) cannot be imported there.
 */

/** Who the Message button should address, given the band's assigned contacts. */
export function defaultContact(contacts: BandContact[] | undefined): BandContact | null {
  return contacts?.[0] ?? null
}

/**
 * The clause naming the band in the pitch body — empty when the greeting is
 * already the band itself, so a band with no contact reads exactly as before
 * ("We haven't played a gig together since …") instead of naming itself twice.
 */
export function bandMention(bandName: string, recipientName: string): string {
  const band = bandName.trim()
  const recipient = recipientName.trim()

  if (!band) return ''
  if (band.toLowerCase() === recipient.toLowerCase()) return ''

  return ` with ${band}`
}
