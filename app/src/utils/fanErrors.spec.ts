import { describe, expect, it } from 'vitest'
import { ApiError, ApiValidationError } from '@/api/client'
import { fanErrorMessage } from './fanErrors'

const FALLBACK = 'Coś poszło nie tak.'

describe('fanErrorMessage', () => {
  it('joins a validation bag', () => {
    expect(fanErrorMessage(new ApiValidationError({ email: ['Pole jest wymagane.'] }), FALLBACK))
      .toBe('Pole jest wymagane.')
  })

  it('survives a validation error built with no bag', () => {
    // The field is typed non-optional, but fanHandleResponse used to construct
    // it from an absent `errors` key — and `Object.values(undefined)` threw a
    // TypeError from inside the caller's own catch, leaving the fan with the
    // form re-enabled and no message at all.
    const broken = new ApiValidationError(undefined as unknown as Record<string, string[]>)
    expect(fanErrorMessage(broken, FALLBACK)).toBe(FALLBACK)
  })

  it('shows a message the server wrote for us', () => {
    // `__('api.fan.transfer_already_open')` — resolved in the fan's language.
    expect(fanErrorMessage(new ApiError(422, 'Ten bilet już czeka na odbiór.'), FALLBACK))
      .toBe('Ten bilet już czeka na odbiór.')
    expect(fanErrorMessage(new ApiError(403, 'Ten bilet nie należy do ciebie.'), FALLBACK))
      .toBe('Ten bilet nie należy do ciebie.')
  })

  it('hides the framework English a 429 or 5xx carries', () => {
    // ThrottleRequestsException's message is hardcoded and has no pl entry, and
    // a 429 is exactly what the fan routes' throttles produce.
    expect(fanErrorMessage(new ApiError(429, 'Too Many Attempts.'), FALLBACK)).toBe(FALLBACK)
    expect(fanErrorMessage(new ApiError(500, 'Server Error'), FALLBACK)).toBe(FALLBACK)
    expect(fanErrorMessage(new ApiError(503, 'Service Unavailable'), FALLBACK)).toBe(FALLBACK)
  })

  it('falls back for an empty message, a plain Error and a non-error', () => {
    expect(fanErrorMessage(new ApiError(404, ''), FALLBACK)).toBe(FALLBACK)
    expect(fanErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK)
    expect(fanErrorMessage('boom', FALLBACK)).toBe(FALLBACK)
  })

  it('passes an empty fallback through, for a template with its own v-else', () => {
    expect(fanErrorMessage(new ApiError(429, 'Too Many Attempts.'), '')).toBe('')
  })
})
