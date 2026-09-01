/**
 * Decides what the concerts admin may say about the venue list.
 *
 * A concert cannot exist without a venue, so with none defined the create form
 * is a dead end and "+ Add concert" is disabled. Only a *settled* query proves
 * that: disabling on any non-success state blames a missing venue for what may
 * be a failed fetch, and leaves the user no way forward.
 *
 * The button state and the notice are both derived from `noVenues` here so the
 * two cannot drift apart — which is precisely how the original bug arose.
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
  /** Confirmed empty: disable creation and explain why. */
  noVenues: boolean
  /** The list could not be loaded; creation stays available as a backstop. */
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
