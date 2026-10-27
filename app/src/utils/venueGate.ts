/**
 * Decides what the concerts admin may say about the venue list.
 *
 * A concert cannot exist without a venue, so with none defined the page shows
 * a notice pointing at the concert form's own "New venue" button (it used to
 * disable "+ Add concert" outright, before the form could create a venue
 * itself). Only a *settled* query proves the list is empty: reacting to any
 * non-success state blames a missing venue for what may be a failed fetch.
 *
 * The notice and `venuesFailed` are both derived here so the two states cannot
 * drift apart — which is precisely how the original bug arose.
 */

export interface VenueQueryState {
  /** The query settled successfully. */
  isSuccess: boolean
  /** The query settled in error (after TanStack's retries). */
  isError: boolean
  /** Rows returned; `undefined` while loading or on error. */
  data: readonly unknown[] | undefined
}

export interface VenueGate {
  /** At least one venue is known to exist. */
  hasVenues: boolean
  /** Confirmed empty: show the notice pointing at the form's own "New venue". */
  noVenues: boolean
  /** The list could not be loaded; say so rather than claim it is empty. */
  venuesFailed: boolean
}

export function venueGate(state: VenueQueryState): VenueGate {
  const hasVenues = (state.data ?? []).length > 0

  return {
    hasVenues,
    // `isSuccess` is load-bearing: without it a failed or in-flight fetch reads
    // as "there are no venues", which is a different and much worse claim.
    noVenues: state.isSuccess && !hasVenues,
    venuesFailed: state.isError,
  }
}
