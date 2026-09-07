import { describe, expect, it } from 'vitest'
import { bandMention, defaultContact } from './pitchRecipient'
import type { BandContact } from '@/types/band'

const contact = (id: number, name: string): BandContact => ({
  id, name, email: null, phone: null, whatsapp: null,
})

describe('defaultContact', () => {
  it('returns null when the band has no contacts', () => {
    expect(defaultContact([])).toBeNull()
  })

  it('returns null when contacts are absent entirely', () => {
    expect(defaultContact(undefined)).toBeNull()
  })

  it('picks the first contact, which the API orders by name', () => {
    expect(defaultContact([contact(2, 'Ada'), contact(7, 'Zoe')])?.name).toBe('Ada')
  })
})

describe('bandMention', () => {
  it('names the band when writing to a person', () => {
    expect(bandMention('Iron Fist', 'Mia Manager')).toBe(' with Iron Fist')
  })

  it('stays empty when the greeting is already the band', () => {
    expect(bandMention('Iron Fist', 'Iron Fist')).toBe('')
  })

  it('ignores case and surrounding space when comparing', () => {
    expect(bandMention('  Iron Fist ', 'iron fist')).toBe('')
  })

  it('stays empty when there is no band name', () => {
    expect(bandMention('', 'Mia Manager')).toBe('')
  })

  it('names the band when the recipient field was cleared', () => {
    expect(bandMention('Iron Fist', '')).toBe(' with Iron Fist')
  })
})
