/**
 * The rule that decides whether "+ Add concert" is a dead end.
 *
 * This exists as a pure function because the bug it guards against was two
 * conditions drifting apart: the button disabled on `!hasVenues` while the
 * explanatory notice required `isSuccess`. They agreed on every state except
 * a failed fetch — where the button went dead and the notice stayed hidden,
 * leaving a tooltip blaming a missing venue for what was really a 401 or a
 * proxy blip. Deriving both from one `noVenues` makes that divergence
 * unrepresentable; these tests pin the states down.
 */

import { describe, expect, it } from 'vitest'
import { venueGate } from './venueGate'

const loading = { isSuccess: false, isError: false, data: undefined }
const failed = { isSuccess: false, isError: true, data: undefined }
const empty = { isSuccess: true, isError: false, data: [] }
const populated = { isSuccess: true, isError: false, data: [{ id: 1 }] }

describe('venueGate', () => {
  it('reports no venues only once the query has settled empty', () => {
    expect(venueGate(empty)).toEqual({
      hasVenues: false,
      noVenues: true,
      venuesFailed: false,
    })
  })

  it('does not report "no venues" when the fetch failed', () => {
    // The regression this module exists for: an error must never be presented
    // as an empty venue list, or the user is told to create what already exists.
    expect(venueGate(failed).noVenues).toBe(false)
    expect(venueGate(failed).venuesFailed).toBe(true)
  })

  it('does not report "no venues" while the query is still loading', () => {
    expect(venueGate(loading).noVenues).toBe(false)
    expect(venueGate(loading).venuesFailed).toBe(false)
  })

  it('reports venues present once they arrive', () => {
    expect(venueGate(populated)).toEqual({
      hasVenues: true,
      noVenues: false,
      venuesFailed: false,
    })
  })

  it('treats a success carrying no data as empty rather than throwing', () => {
    expect(venueGate({ isSuccess: true, isError: false, data: undefined }).noVenues).toBe(true)
  })

  it('never reports both "no venues" and "failed" at once', () => {
    for (const state of [loading, failed, empty, populated]) {
      const gate = venueGate(state)
      expect(gate.noVenues && gate.venuesFailed).toBe(false)
    }
  })
})
