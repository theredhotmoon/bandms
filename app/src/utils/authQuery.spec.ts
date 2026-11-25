import { describe, expect, it, vi } from 'vitest'
import { providerName, providerUrl, readAuthQuery, stripFacebookHash } from './authQuery'

vi.mock('@/api/client', () => ({ API_BASE: 'https://api.test' }))

describe('readAuthQuery', () => {
  it('maps the known values', () => {
    expect(readAuthQuery({ auth_error: 'cancelled' })).toEqual({ error: 'cancelled', notice: null })
    expect(readAuthQuery({ auth_error: 'no_email' }).error).toBe('no_email')
    expect(readAuthQuery({ auth_error: 'failed' }).error).toBe('failed')
    expect(readAuthQuery({ auth_notice: 'confirm_email' })).toEqual({ error: null, notice: 'confirm_email' })
  })

  it('nulls unknown values and arrays', () => {
    expect(readAuthQuery({ auth_error: 'boom', auth_notice: 'hello' })).toEqual({ error: null, notice: null })
    expect(readAuthQuery({ auth_error: ['failed'], auth_notice: ['confirm_email'] })).toEqual({ error: null, notice: null })
    expect(readAuthQuery({})).toEqual({ error: null, notice: null })
  })
})

describe('providerUrl', () => {
  it('omits return_to and claim_hash when there are none', () => {
    expect(providerUrl('google', 'pl', null, null)).toBe('https://api.test/api/fan/auth/google/redirect?lang=pl')
  })

  it('omits a language nobody chose', () => {
    expect(providerUrl('google', null, null, null)).toBe('https://api.test/api/fan/auth/google/redirect')
    expect(providerUrl('google', null, null, 'abc')).toBe('https://api.test/api/fan/auth/google/redirect?claim_hash=abc')
  })

  it('encodes a claim hash', () => {
    expect(providerUrl('facebook', 'en', null, 'abc')).toBe('https://api.test/api/fan/auth/facebook/redirect?lang=en&claim_hash=abc')
  })

  it('encodes a return path and drops a foreign one', () => {
    expect(providerUrl('google', 'en', '/a b', null)).toContain('return_to=%2Fa%20b')
    expect(providerUrl('google', 'en', '//evil.example', null)).not.toContain('return_to')
  })
})

describe('providerName', () => {
  it('uses the proper names', () => {
    expect(providerName('google')).toBe('Google')
    expect(providerName('facebook')).toBe('Facebook')
    expect(providerName('myspace')).toBe('')
    expect(providerName('constructor')).toBe('')
  })
})

describe('stripFacebookHash', () => {
  it('drops exactly #_=_', () => {
    expect(stripFacebookHash('#_=_')).toBe('')
    expect(stripFacebookHash('#_=_x')).toBe('#_=_x')
    expect(stripFacebookHash('#other')).toBe('#other')
  })
})
