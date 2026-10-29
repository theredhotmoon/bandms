import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { Lang } from '@/locales'
import { firstInOrder, sortTagsByLabel, sortedByLabel, tagLabel, tagNames, tagTerms } from './localeOrder'

describe('firstInOrder', () => {
  it('reads the first language in the band order, not the default locale', () => {
    expect(firstInOrder({ en: 'Live', pl: 'Na żywo' }, ['pl', 'en'])).toBe('Na żywo')
    expect(firstInOrder({ en: 'Live', pl: 'Na żywo' }, ['en', 'pl'])).toBe('Live')
  })

  it('falls through to the next language when the first is blank or whitespace', () => {
    expect(firstInOrder({ en: 'Live', pl: null }, ['pl', 'en'])).toBe('Live')
    expect(firstInOrder({ en: 'Live', pl: '   ' }, ['pl', 'en'])).toBe('Live')
    expect(firstInOrder({ en: 'Live' }, ['pl', 'en'])).toBe('Live')
  })

  it('returns null when nothing is filled, so the caller picks the placeholder', () => {
    expect(firstInOrder({ en: '', pl: null }, ['pl', 'en'])).toBeNull()
    expect(firstInOrder(undefined, ['pl', 'en'])).toBeNull()
  })
})

describe('tagLabel', () => {
  const tag = { name: 'Live', translations: { name: { en: 'Live', pl: 'Na żywo' } } }

  it("shows the band's first language, not the request-language name", () => {
    expect(tagLabel(tag, ['pl', 'en'])).toBe('Na żywo')
    expect(tagLabel(tag, ['en', 'pl'])).toBe('Live')
  })

  it('falls back to the resolved name when an embed carries no translations', () => {
    expect(tagLabel({ name: 'Live' }, ['pl', 'en'])).toBe('Live')
  })
})

describe('tagTerms', () => {
  it('covers every language of the name and slug, lowercased, once each', () => {
    const tag = {
      name: 'Live', slug: 'live',
      translations: { name: { en: 'Live', pl: 'Na żywo' }, slug: { en: 'live', pl: 'na-zywo' } },
    }
    expect(tagTerms(tag).sort()).toEqual(['live', 'na żywo', 'na-zywo'])
  })

  it('does not throw on a tag with no translations', () => {
    expect(tagTerms({ name: 'Live', slug: 'live' })).toEqual(['live'])
    expect(tagTerms({ name: 'Live', translations: null })).toEqual(['live'])
  })
})

describe('tagNames', () => {
  it('covers every language of the name but no slug', () => {
    const tag = {
      name: 'Live', slug: 'live',
      translations: { name: { en: 'Live', pl: 'Na żywo' }, slug: { en: 'live', pl: 'na-zywo' } },
    }
    expect(tagNames(tag).sort()).toEqual(['live', 'na żywo'])
  })
})

describe('sortTagsByLabel', () => {
  const tag = (en: string, pl: string) => ({ name: en, translations: { name: { en, pl } } })
  const tags = [tag('Club', 'Klub'), tag('Festival', 'Festiwal'), tag('Acoustic', 'Akustyczny'), tag('Zine', 'Ćwiczenia')]

  it('orders by the shown name in the band language, with its collation', () => {
    expect(sortTagsByLabel(tags, ['pl', 'en']).map(t => tagLabel(t, ['pl', 'en'])))
      .toEqual(['Akustyczny', 'Ćwiczenia', 'Festiwal', 'Klub'])
    expect(sortTagsByLabel(tags, ['en', 'pl']).map(t => t.name)).toEqual(['Acoustic', 'Club', 'Festival', 'Zine'])
  })

  it('does not mutate its input', () => {
    const before = tags.map(t => t.name)
    sortTagsByLabel(tags, ['pl', 'en'])
    expect(tags.map(t => t.name)).toEqual(before)
  })
})

describe('sortedByLabel', () => {
  const tags = [
    { name: 'concert', translations: { name: { en: 'concert', pl: 'koncert' } } },
    { name: 'festival', translations: { name: { en: 'festival', pl: 'festiwal' } } },
    { name: 'cracow', translations: { name: { en: 'cracow', pl: 'kraków' } } },
  ]
  const labels = (sorted: typeof tags) => sorted.map((t) => tagLabel(t, ['pl', 'en']))

  // vue-query re-runs a `select` only when the function itself changes, so
  // the builder must hand out a new one whenever the order does. Reading the
  // order inside the returned function instead tracks nothing: the list kept
  // the order of first load — the registry's, English-first — while the
  // labels switched to Polish.
  it('hands out a new select function when the order changes', () => {
    const order = ref<Lang[]>(['en', 'pl'])
    const select = sortedByLabel(order)
    const before = select.value

    order.value = ['pl', 'en']

    expect(select.value).not.toBe(before)
  })

  // Each function is bound to the order it was built for. That is what makes
  // a new one necessary — and what the broken shape lacked: it read the order
  // lazily, so the old function sorted the new way too, and nothing told
  // vue-query its cached result was stale.
  it('binds each select to the order it was built for', () => {
    const order = ref<Lang[]>(['en', 'pl'])
    const select = sortedByLabel(order)
    const englishFirst = select.value

    order.value = ['pl', 'en']

    expect(labels(englishFirst(tags))).toEqual(['koncert', 'kraków', 'festiwal'])
    expect(labels(select.value(tags))).toEqual(['festiwal', 'koncert', 'kraków'])
  })
})
