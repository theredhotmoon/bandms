import { describe, expect, it } from 'vitest'
import { matchesContactQuery } from './contactSearch'

const jean = { name: 'Jean Dupont', email: 'jean@presse.fr', phone: '+33 1 23', country: 'FR', contact_language: 'fr' }
const kofi = { name: 'Kofi Mensah', email: null, phone: null, country: 'GH', contact_language: 'en' }

describe('matchesContactQuery', () => {
  it('matches name, email and phone anywhere', () => {
    expect(matchesContactQuery(jean, 'dupont', 'en')).toBe(true)
    expect(matchesContactQuery(jean, 'presse', 'en')).toBe(true)
    expect(matchesContactQuery(jean, '+33', 'en')).toBe(true)
  })

  it('matches a country or language by the start of its name in the UI language', () => {
    expect(matchesContactQuery(jean, 'fran', 'en')).toBe(true)
    expect(matchesContactQuery(jean, 'frenc', 'en')).toBe(true)
    expect(matchesContactQuery(jean, 'franc', 'pl')).toBe(true) // Francja / francuski
  })

  it('does not match a country by a fragment from its middle', () => {
    expect(matchesContactQuery(kofi, 'ana', 'en')).toBe(false) // Ghana
  })

  it('matches an exact country or language code', () => {
    // "de" starts neither "Germany" nor "German", so only the code can match it.
    const hans = { name: 'Hans Weber', email: null, phone: null, country: 'DE', contact_language: 'de' }
    expect(matchesContactQuery(hans, 'de', 'en')).toBe(true)
    expect(matchesContactQuery({ ...hans, contact_language: null }, 'de', 'en')).toBe(true)
    expect(matchesContactQuery({ ...hans, country: null }, 'de', 'en')).toBe(true)
  })

  it('matches everything on an empty query and nothing on a miss', () => {
    expect(matchesContactQuery(kofi, '', 'en')).toBe(true)
    expect(matchesContactQuery(kofi, 'zzz', 'en')).toBe(false)
  })
})
