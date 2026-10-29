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
/** Case and spacing aside — "Iron  Fist" and "iron fist" are one name. */
const normalise = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

export function bandMention(bandName: string, recipientName: string): string {
  const band = bandName.trim()

  if (!band) return ''
  if (normalise(band) === normalise(recipientName)) return ''

  return ` with ${band}`
}

/**
 * The name after "Hi": the picked contact's first name, or what was typed.
 *
 * Keyed on the contact that was *picked*, never on matching the text against
 * every author: two authors can share a full name with different splits, and
 * the box starts out holding the band's name, which may equal some unrelated
 * author's. So free text — a half-typed name, someone not in the contacts, a
 * band name — is greeted exactly as typed, and so is a picked contact whose
 * name has since been edited in the box.
 */
export function greetingName(
  recipient: string,
  picked: Pick<BandContact, 'name' | 'first_name'> | null,
): string {
  const typed = recipient.trim()
  if (!typed) return ''

  if (picked && normalise(picked.name) === normalise(typed)) return picked.first_name || typed
  return typed
}
