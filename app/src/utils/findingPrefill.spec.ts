import { describe, expect, it } from 'vitest'
import { defaultSaveTarget, leadName, prefillFor } from './findingPrefill'
import type { Finding } from '@/types/assistantCrawler'

const base: Finding = {
  id: 7, kind: 'lead', source: 'places', url: 'https://minoga.example', title: 'Klub Pod Minogą, Kraków',
  snippet: '', country: 'PL', lead_type: 'venue', score: 80, status: 'new', summary: null,
  saved_type: null, saved_id: null, found_at: null, known: null, duplicate_of: null, contacts: null,
}

describe('leadName', () => {
  it('takes the title up to its first separator', () => {
    expect(leadName('Klub Pod Minogą, Kraków')).toBe('Klub Pod Minogą')
    expect(leadName('The Busters — official site')).toBe('The Busters')
    expect(leadName('Ska Fest | tickets')).toBe('Ska Fest')
    expect(leadName('Plain name')).toBe('Plain name')
  })
})

describe('defaultSaveTarget', () => {
  it('maps a lead type to the table it belongs in', () => {
    expect(defaultSaveTarget('venue')).toEqual({ type: 'venue' })
    expect(defaultSaveTarget('festival')).toEqual({ type: 'band', kind: 'festival' })
    expect(defaultSaveTarget('promoter')).toEqual({ type: 'band', kind: 'promoter' })
    expect(defaultSaveTarget('band')).toEqual({ type: 'band', kind: 'band' })
    expect(defaultSaveTarget('media')).toEqual({ type: 'author' })
    expect(defaultSaveTarget(null)).toEqual({ type: 'venue' })
  })
})

describe('prefillFor', () => {
  it('fills a venue with name, country and website, preferring the contact website triage read', () => {
    expect(prefillFor({ ...base, contacts: { website: 'https://minoga.pl' } }, { type: 'venue' })).toEqual({
      name: 'Klub Pod Minogą', country: 'PL', website: 'https://minoga.pl',
    })
  })

  it('fills a band with its kind', () => {
    expect(prefillFor({ ...base, lead_type: 'festival', title: 'Ska Fest' }, { type: 'band', kind: 'festival' }))
      .toEqual({ name: 'Ska Fest', kind: 'festival', country: 'PL', website: 'https://minoga.example' })
  })

  it('takes the finding\'s own link as the website only for a Places result that is not a Maps page', () => {
    expect(prefillFor({ ...base, url: 'https://www.google.com/maps/place/?q=place_id:x' }, { type: 'venue' })).toMatchObject({ website: null })
    expect(prefillFor({ ...base, source: 'google_cse', url: 'https://news.example/festival-article' }, { type: 'band', kind: 'festival' }))
      .toMatchObject({ website: null })
  })

  it('fills a contact with the email and social links triage found', () => {
    const out = prefillFor({ ...base, contacts: { email: 'booking@x.example', instagram: 'https://instagram.com/x' } }, { type: 'author' })
    expect(out).toMatchObject({ first_name: 'Klub Pod Minogą', email: 'booking@x.example', country: 'PL' })
    expect((out as { social_links: unknown }).social_links).toEqual([{ platform: 'instagram', url: 'https://instagram.com/x' }])
  })

  it('never uses a non-http website', () => {
    expect(prefillFor({ ...base, url: 'javascript:alert(1)', contacts: null }, { type: 'venue' })).toEqual({
      name: 'Klub Pod Minogą', country: 'PL', website: null,
    })
  })
})
