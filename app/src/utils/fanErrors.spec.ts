import { describe, expect, it } from 'vitest'
import { ApiError, ApiValidationError } from '@/api/client'
import { fanErrorMessage, linkWasRefused, serverRefused } from './fanErrors'

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

describe('fanErrorMessage with a code', () => {
  it('shows a 429 only when it is the login limit the API worded', () => {
    expect(fanErrorMessage(new ApiError(429, 'Za dużo prób.', 'login_limit'), FALLBACK)).toBe('Za dużo prób.')
  })

  it('still hides a 429 with no code or another code', () => {
    expect(fanErrorMessage(new ApiError(429, 'Too Many Attempts.'), FALLBACK)).toBe(FALLBACK)
    expect(fanErrorMessage(new ApiError(429, 'Too Many Attempts.', 'other'), FALLBACK)).toBe(FALLBACK)
  })

  it('keeps showing a 422 with a code', () => {
    expect(fanErrorMessage(new ApiError(422, 'Nieprawidłowe dane.', 'login_failed'), FALLBACK)).toBe('Nieprawidłowe dane.')
  })
})

describe('linkWasRefused', () => {
  it('is true only for a 401: the link is used up or expired', () => {
    expect(linkWasRefused(new ApiError(401, 'Invalid or expired token.'))).toBe(true)
  })

  it('is false for every failure that leaves the link good', () => {
    for (const status of [404, 422, 429, 500, 502, 503]) {
      expect(linkWasRefused(new ApiError(status, ''))).toBe(false)
    }
    expect(linkWasRefused(new ApiValidationError({ token: ['x'] }))).toBe(false)
    expect(linkWasRefused(new TypeError('Failed to fetch'))).toBe(false)
    expect(linkWasRefused(new DOMException('aborted', 'AbortError'))).toBe(false)
    // A 200 that is not JSON: a portal's or a proxy's page, not the API.
    expect(linkWasRefused(new SyntaxError('Unexpected token <'))).toBe(false)
  })
})

describe('serverRefused', () => {
  it('is true for an error status the API answered with', () => {
    expect(serverRefused(new ApiError(429, ''))).toBe(true)
    expect(serverRefused(new ApiError(503, 'mail failed'))).toBe(true)
    expect(serverRefused(new ApiValidationError({ password: ['x'] }))).toBe(true)
  })

  it('is false when it is not known what the server did', () => {
    expect(serverRefused(new TypeError('Failed to fetch'))).toBe(false)
    expect(serverRefused(new DOMException('aborted', 'AbortError'))).toBe(false)
    expect(serverRefused(new SyntaxError('Unexpected token <'))).toBe(false)
    // The gateway gave up waiting; the API may have gone on and sent the mail.
    expect(serverRefused(new ApiError(502, ''))).toBe(false)
    expect(serverRefused(new ApiError(504, ''))).toBe(false)
  })
})
