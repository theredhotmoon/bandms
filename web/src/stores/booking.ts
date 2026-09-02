import { atom } from 'nanostores'

/**
 * A date the visitor picked in the availability calendar, as `YYYY-MM-DD`,
 * plus whether the calendar considered that date unavailable.
 *
 * `unavailable` is true when the picked day was marked booked or held and the
 * visitor confirmed the warning. The form flags the clash in the subject so
 * the band can triage the enquiry without cross-checking their own calendar.
 */
export interface BookingRequest {
  date: string
  unavailable: boolean
}

/**
 * The handoff between the availability calendar and the contact form.
 *
 * The two are separate Astro islands, so they cannot pass props to each other
 * — this atom is the channel, the same way the cart icon and drawer share
 * `cartItems`.
 *
 * Deliberately not a submission: the calendar collects no name or email, so
 * "request this date" pre-fills the booking form rather than sending anything.
 * A one-click anonymous enquiry would be unanswerable and trivially spammable.
 *
 * The form clears this once consumed, so re-picking the same date fires again.
 */
export const bookingRequest = atom<BookingRequest | null>(null)

export function requestBookingFor(date: string, unavailable = false) {
  bookingRequest.set({ date, unavailable })
}

export function clearBookingRequest() {
  bookingRequest.set(null)
}
