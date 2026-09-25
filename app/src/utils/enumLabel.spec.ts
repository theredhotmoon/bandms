import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import { enumLabel } from './enumLabel'
import { gapWords } from './riderGaps'
import en from '@/i18n/en'
import pl from '@/i18n/pl'

/**
 * Both helpers exist for the same reason: vue-i18n returns the *keypath* when
 * a key is missing, not an empty string. That turns a value the catalogue has
 * not caught up with into `rider.rig.wireless.types.dante` printed into a
 * table cell, which reads as corruption rather than as a gap.
 */
function t(locale: 'en' | 'pl') {
  const i18n = createI18n({ legacy: false, locale, messages: { en, pl } })
  return i18n.global.t as (k: string) => string
}

describe('enumLabel', () => {
  it('returns the catalogue label for a known value', () => {
    // The admin's wording is deliberately more descriptive than the printed
    // sheet's terse 'IEM' — a form field explains, a table column does not.
    expect(enumLabel(t('en'), 'rider.rig.wireless.types.iem', 'iem')).toBe('IEM pack (wireless monitor)')
    expect(enumLabel(t('pl'), 'rider.rig.backline.categories.drum_kit', 'drum_kit')).toBe('Perkusja')
  })

  it('falls back to the raw stored value when the key is missing', () => {
    // The shape that matters: a legacy row, or a value the API gains before
    // the catalogue does. `amp_rack` is deliberately not a BacklineCategory.
    expect(enumLabel(t('en'), 'rider.rig.backline.categories.amp_rack', 'amp_rack')).toBe('amp_rack')
    expect(enumLabel(t('pl'), 'rider.rig.chains.quantum_flux.label', 'quantum_flux')).toBe('quantum_flux')
  })
})

describe('gapWords', () => {
  it('translates the keys placementStatus returns', () => {
    // rider-core has no catalogue, so it returns stable keys and the admin
    // does the wording. Left untranslated this read "brak: inputs, monitor".
    expect(gapWords(['inputs', 'monitor'], t('pl'))).toBe('wejść, odsłuchu')
    expect(gapWords(['instrument'], t('en'))).toBe('instrument')
  })

  it('prints an unknown key rather than dropping it', () => {
    // A gap list that silently lost an entry would claim the rider is more
    // complete than it is — worse than an ugly word.
    expect(gapWords(['inputs', 'telepathy'], t('en'))).toBe('inputs, telepathy')
  })

  it('is empty for a complete placement', () => {
    expect(gapWords([], t('pl'))).toBe('')
  })
})
