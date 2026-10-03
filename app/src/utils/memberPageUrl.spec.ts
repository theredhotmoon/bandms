import { describe, expect, it } from 'vitest'
import { memberPageUrl } from './memberPageUrl'

const about = { slug: 'about', custom_slug: { en: null, pl: 'o-nas' } }

describe('memberPageUrl', () => {
  it('builds the default-locale page URL from the origin, About slug and member slug', () => {
    expect(memberPageUrl('https://band.example', [about], 'jan-kowalski'))
      .toBe('https://band.example/en/about/jan-kowalski')
  })

  it('uses a custom About slug in the default locale', () => {
    const renamed = { slug: 'about', custom_slug: { en: 'the-band', pl: 'o-nas' } }
    expect(memberPageUrl('https://band.example', [renamed], 'jan'))
      .toBe('https://band.example/en/the-band/jan')
  })

  it('falls back to the module key when the modules list is not available', () => {
    expect(memberPageUrl('https://band.example', undefined, 'jan'))
      .toBe('https://band.example/en/about/jan')
  })

  it('returns null for a member with no slug yet', () => {
    expect(memberPageUrl('https://band.example', [about], undefined)).toBeNull()
  })
})
