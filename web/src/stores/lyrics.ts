import { atom } from 'nanostores'

/**
 * Track id whose lyrics should be shown, set from a tracklist row.
 *
 * The discography and the lyrics sheet are separate islands, so the selection
 * crosses through a store — the same handoff the availability calendar uses to
 * reach the contact form.
 *
 * The viewer clears it once consumed, so tapping the same track twice re-fires
 * (and re-scrolls) rather than appearing to do nothing.
 */
export const requestedLyricTrack = atom<number | null>(null)

export function showLyricsFor(trackId: number) {
  requestedLyricTrack.set(trackId)
}

export function clearLyricRequest() {
  requestedLyricTrack.set(null)
}
