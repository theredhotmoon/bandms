import { atom } from 'nanostores'

/**
 * A date the visitor picked in the availability calendar, as `YYYY-MM-DD`.
 *
 * The calendar and the contact form are separate Astro islands, so they cannot
 * pass props to each other — this atom is the handoff, the same way the cart
 * icon and drawer share `cartItems`.
 *
 * Deliberately not a submission: the calendar collects no name or email, so
 * "request this date" pre-fills the booking form rather than sending anything.
 * A one-click anonymous enquiry would be unanswerable and trivially spammable.
 *
 * The form clears this once consumed, so re-picking the same date fires again.
 */
export const bookingRequest = atom<string | null>(null)

export function requestBookingFor(date: string) {
  bookingRequest.set(date)
}

export function clearBookingRequest() {
  bookingRequest.set(null)
}
