import { describe, expect, it } from 'vitest'
import { copyFieldsFor, copyGroupsFor, defaultFor, defineCopy, fillCopy, MODULE_COPY, resolveCopy } from './index'

const FIELDS = defineCopy([
  { key: 'title', label: 'Title', group: 'Header', defaults: { en: 'Shows', pl: 'Koncerty' } },
  { key: 'lead', label: 'Lead', group: 'Header', defaults: { en: 'English only' } },
  { key: 'badge', label: 'Badge', group: 'Hero', defaults: { en: '', pl: '' } },
])

describe('resolveCopy', () => {
  it('returns the locale default when nothing is overridden', () => {
    const t = resolveCopy(FIELDS, 'pl', {})
    expect(t.title).toBe('Koncerty')
  })

  it('prefers a non-empty override', () => {
    const t = resolveCopy(FIELDS, 'pl', { title: 'Gigi' })
    expect(t.title).toBe('Gigi')
  })

  it('treats whitespace-only overrides as absent', () => {
    // A stray space in the admin must not blank a heading.
    const t = resolveCopy(FIELDS, 'en', { title: '   ' })
    expect(t.title).toBe('Shows')
  })

  it('ignores non-string overrides', () => {
    const t = resolveCopy(FIELDS, 'en', { title: 42, lead: null })
    expect(t.title).toBe('Shows')
    expect(t.lead).toBe('English only')
  })

  it('falls back to en for a locale with no default of its own', () => {
    // The registry, not a scan of other locales, decides the fallback —
    // and a third language must not blank every string.
    const t = resolveCopy(FIELDS, 'pl', {})
    expect(t.lead).toBe('English only')
    expect(resolveCopy(FIELDS, 'de', {}).title).toBe('Shows')
  })

  it('keeps an empty default empty — "hidden until written"', () => {
    expect(resolveCopy(FIELDS, 'en', {}).badge).toBe('')
    expect(resolveCopy(FIELDS, 'en', { badge: 'NEW' }).badge).toBe('NEW')
  })

  it('tolerates a missing settings bag', () => {
    // An API predating the settings migration omits the bag entirely.
    expect(resolveCopy(FIELDS, 'en', undefined).title).toBe('Shows')
    expect(resolveCopy(FIELDS, 'en', null).title).toBe('Shows')
  })

  it('emits every key, and only the registry keys', () => {
    const t = resolveCopy(FIELDS, 'en', { stray: 'x' })
    expect(Object.keys(t).sort()).toEqual(['badge', 'lead', 'title'])
  })
})

describe('defaultFor', () => {
  it('reads the locale default, falling back to en', () => {
    expect(defaultFor(FIELDS[0], 'pl')).toBe('Koncerty')
    expect(defaultFor(FIELDS[1], 'pl')).toBe('English only')
  })
})

describe('fillCopy', () => {
  it('substitutes known tokens and leaves unknown ones visible', () => {
    expect(fillCopy('{n} left of {total}', { n: 3 })).toBe('3 left of {total}')
  })
})

describe('the registry', () => {
  const slugs = Object.keys(MODULE_COPY)

  it('covers every module the public site reads copy for', () => {
    expect(slugs).toEqual(expect.arrayContaining([
      'about', 'concerts', 'contact', 'epk', 'footer', 'home', 'merch',
      'newsletter', 'photos', 'posts', 'press', 'privacy', 'releases', 'site', 'videos',
    ]))
  })

  it.each(slugs)('%s: keys are unique and every field has an en default', slug => {
    const fields = copyFieldsFor(slug)
    const keys = fields.map(f => f.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const field of fields) {
      expect(typeof field.defaults.en, `${slug}.${field.key}`).toBe('string')
      expect(field.label.length, `${slug}.${field.key} label`).toBeGreaterThan(0)
      expect(field.group.length, `${slug}.${field.key} group`).toBeGreaterThan(0)
    }
  })

  it.each(slugs)('%s: no default exceeds the field cap or the server cap', slug => {
    for (const field of copyFieldsFor(slug)) {
      for (const [locale, text] of Object.entries(field.defaults)) {
        expect(text.length, `${slug}.${field.key}.${locale}`).toBeLessThanOrEqual(field.maxLength ?? 2000)
        expect(text.length).toBeLessThanOrEqual(2000)
      }
    }
  })

  it('keeps the keys the band already saved overrides under', () => {
    // These predate the registry and are what `website_modules.settings`
    // rows in production hold. Renaming one silently drops the saved text.
    const contact = copyFieldsFor('contact').map(f => f.key)
    expect(contact).toEqual(expect.arrayContaining([
      'title', 'kicker', 'lead', 'reply_time_label', 'booking_note', 'press_note', 'general_note',
    ]))
    const footer = copyFieldsFor('footer').map(f => f.key)
    expect(footer).toEqual(expect.arrayContaining([
      'tagline', 'booking_title', 'booking_text', 'follow_title', 'rights',
    ]))
    for (const page of ['about', 'concerts', 'releases', 'posts', 'photos', 'videos', 'press', 'merch', 'epk', 'newsletter']) {
      expect(copyFieldsFor(page).map(f => f.key), page).toEqual(expect.arrayContaining(['title', 'lead']))
    }
  })

  it('groups fields in first-appearance order', () => {
    const groups = copyGroupsFor('concerts')
    expect(groups[0]?.group).toBe('Page header')
    expect(groups.flatMap(g => g.fields).length).toBe(copyFieldsFor('concerts').length)
  })

  it('returns nothing for an unknown module', () => {
    expect(copyFieldsFor('nope')).toEqual([])
    expect(copyGroupsFor('nope')).toEqual([])
  })
})
