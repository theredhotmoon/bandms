import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COUNTRY_CODES, CONTACT_LANGUAGE_CODES, contactLanguageOptions, countryOptions } from './contactCodes'

describe('parity with the API', () => {
  // The API validates against its own copy; a code in only one list is either
  // offered and then rejected with a 422, or accepted and never offered.
  const php = readFileSync(fileURLToPath(new URL('../../../api/app/Support/ContactCodes.php', import.meta.url)), 'utf8')
  const phpList = (name: string): string[] => {
    const body = php.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))?.[1]
    if (!body) throw new Error(`ContactCodes::${name} not found`)
    return [...body.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]!)
  }

  it('offers exactly the countries the API accepts', () => {
    expect([...COUNTRY_CODES]).toEqual(phpList('COUNTRIES'))
  })

  it('offers exactly the languages the API accepts', () => {
    expect([...CONTACT_LANGUAGE_CODES]).toEqual(phpList('LANGUAGES'))
  })
})

describe('countryOptions', () => {
  it('offers every country exactly once', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length)
    expect(countryOptions('en')).toHaveLength(COUNTRY_CODES.length)
  })

  it('names countries in the admin language', () => {
    expect(countryOptions('en').find((o) => o.code === 'DE')?.label).toBe('Germany')
    expect(countryOptions('pl').find((o) => o.code === 'DE')?.label).toBe('Niemcy')
  })

  it('sorts by the localised name, not by code', () => {
    const labels = countryOptions('pl').map((o) => o.label)
    expect(labels).toEqual([...labels].sort(new Intl.Collator('pl').compare))
  })

  it('names every code — none falls back to the raw code', () => {
    expect(countryOptions('en').filter((o) => o.label === o.code)).toEqual([])
  })
})

describe('contactLanguageOptions', () => {
  it('names languages in the admin language', () => {
    expect(new Set(CONTACT_LANGUAGE_CODES).size).toBe(CONTACT_LANGUAGE_CODES.length)
    expect(contactLanguageOptions('en').find((o) => o.code === 'pl')?.label).toBe('Polish')
    expect(contactLanguageOptions('pl').find((o) => o.code === 'de')?.label).toBe('niemiecki')
  })

  it('names every code', () => {
    expect(contactLanguageOptions('en').filter((o) => o.label === o.code)).toEqual([])
  })
})
