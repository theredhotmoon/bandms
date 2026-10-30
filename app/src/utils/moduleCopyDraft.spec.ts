import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, LOCALES, emptyBag } from '@/locales'
import { toDraft, toPayload } from './moduleCopyDraft'

const KEYS = ['kicker', 'lead']
const other = LOCALES.find(l => l !== DEFAULT_LOCALE)!

describe('toDraft', () => {
  it('gives every schema field a full bag, blank where the module has nothing', () => {
    const draft = toDraft(KEYS, { kicker: { [DEFAULT_LOCALE]: 'Hi' } })
    expect(draft.kicker[DEFAULT_LOCALE]).toBe('Hi')
    expect(draft.kicker[other]).toBe('')
    expect(draft.lead).toEqual(emptyBag())
  })

  it('treats a null stored value as blank', () => {
    expect(toDraft(KEYS, { kicker: { [DEFAULT_LOCALE]: null } }).kicker[DEFAULT_LOCALE]).toBe('')
  })

  it('ignores stored keys the schema no longer has', () => {
    expect(Object.keys(toDraft(KEYS, { ghost: { [DEFAULT_LOCALE]: 'x' } }))).toEqual(KEYS)
  })
})

describe('toPayload', () => {
  it('sends every registry locale of every field, blank as null', () => {
    const payload = toPayload(KEYS, { kicker: { ...emptyBag(), [DEFAULT_LOCALE]: 'Hi' }, lead: emptyBag() })
    expect(payload.kicker[DEFAULT_LOCALE]).toBe('Hi')
    expect(payload.kicker[other]).toBeNull()
    expect(Object.keys(payload.lead).sort()).toEqual([...LOCALES].sort())
    expect(Object.values(payload.lead).every(v => v === null)).toBe(true)
  })

  it('round-trips a saved bag', () => {
    const stored = { kicker: Object.fromEntries(LOCALES.map(l => [l, `k-${l}`])), lead: Object.fromEntries(LOCALES.map(l => [l, null])) }
    expect(toPayload(KEYS, toDraft(KEYS, stored))).toEqual(stored)
  })
})
