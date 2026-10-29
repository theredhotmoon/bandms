import { describe, expect, it } from 'vitest'
import { bandMention, defaultContact, greetingName } from './pitchRecipient'
import type { BandContact } from '@/types/band'

const contact = (id: number, name: string, first_name = name): BandContact => ({
  id, name, first_name, email: null, phone: null, whatsapp: null,
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

  it('treats a run of spaces as one, like the greeting does', () => {
    expect(bandMention('Iron Fist', 'Iron  Fist')).toBe('')
  })

  it('names the band when the recipient field was cleared', () => {
    expect(bandMention('Iron Fist', '')).toBe(' with Iron Fist')
  })
})

describe('greetingName', () => {
  const mia = contact(1, 'Mia Manager', 'Mia')
  const annaMaria = contact(2, 'Anna Maria Kowalska', 'Anna Maria')

  it('greets the picked contact by first name', () => {
    expect(greetingName('Mia Manager', mia)).toBe('Mia')
  })

  it('keeps a double first name whole — the stored split decides, not the spaces', () => {
    expect(greetingName('Anna Maria Kowalska', annaMaria)).toBe('Anna Maria')
  })

  it('still knows the picked contact under different case and spacing', () => {
    expect(greetingName('  mia   MANAGER ', mia)).toBe('Mia')
  })

  it('greets a one-word contact by the whole name', () => {
    expect(greetingName('Radio 357', contact(3, 'Radio 357'))).toBe('Radio 357')
  })

  it('greets as typed once the name of the picked contact is edited in the box', () => {
    expect(greetingName('Mia from Booking', mia)).toBe('Mia from Booking')
  })

  it('greets free text as typed when nobody was picked', () => {
    expect(greetingName('Someone Else', null)).toBe('Someone Else')
  })

  // The box starts out holding the band's name; that must never become a
  // first name just because some author happens to share it.
  it('never cuts an unpicked band name to its first word', () => {
    expect(greetingName('John Smith', null)).toBe('John Smith')
  })

  it('is empty for an empty recipient', () => {
    expect(greetingName('   ', mia)).toBe('')
  })
})
