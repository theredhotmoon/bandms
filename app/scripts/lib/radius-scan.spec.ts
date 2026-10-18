import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { cardClassOf, cardRules, isCardRadius } from './radius-scan.mjs'

type Rule = { line: number; card: string; radius: string; ok: boolean }
const css = (src: string, opts?: object): Rule[] => cardRules(src, 'css', opts)
const vue = (src: string, opts?: object): Rule[] => cardRules(src, 'vue', opts)

describe('cardClassOf — which rules style a card', () => {
  it('names a *-card class, but not a class that merely contains "card"', () => {
    expect(cardClassOf('.rp-card')).toBe('rp-card')
    expect(cardClassOf('.card')).toBe('card')
    expect(cardClassOf('.rp-card-thumb')).toBeNull()
    expect(cardClassOf('.card-btn')).toBeNull()
    expect(cardClassOf('.song-card--encore')).toBeNull()
  })

  it('judges only the last compound: a descendant of a card is not the card', () => {
    expect(cardClassOf('.venue-card .map')).toBeNull()
    expect(cardClassOf('.venue-card > img')).toBeNull()
    expect(cardClassOf('.list .venue-card')).toBe('venue-card')
  })

  it('keeps a compound or pseudo-class on the card as the card', () => {
    expect(cardClassOf('.venue-card.is-open')).toBe('venue-card')
    expect(cardClassOf('.x-card:hover')).toBe('x-card')
    expect(cardClassOf('.x-card:not(.flat)')).toBe('x-card')
    expect(cardClassOf(':deep(.x-card)')).toBe('x-card')
  })

  it('treats a pseudo-element as its own box, not the card', () => {
    expect(cardClassOf('.x-card::before')).toBeNull()
    expect(cardClassOf('.x-card:after')).toBeNull()
  })

  it('counts a selector list as a card rule when any member is a card', () => {
    expect(cardClassOf('.pill, .x-card')).toBe('x-card')
    expect(cardClassOf('.x-card, .pill')).toBe('x-card')
    expect(cardClassOf('.x-card .a, .pill')).toBeNull()
  })

  it('does not split a comma inside a functional pseudo-class', () => {
    expect(cardClassOf(':is(.a, .b) .x-card')).toBe('x-card')
    expect(cardClassOf('.x-card :is(.a, .b)')).toBeNull()
  })

  it('ignores classes inside :not() and :has(), which name other elements', () => {
    expect(cardClassOf('.pill:not(.x-card)')).toBeNull()
    expect(cardClassOf('.list:has(.song-card)')).toBeNull()
    expect(cardClassOf('.row:not(:is(.a, .x-card))')).toBeNull()
    expect(cardClassOf('.x-card:not(.flat)')).toBe('x-card')
    expect(cardClassOf(':is(.x-card, .pill)')).toBe('x-card')
  })

  it('does not read ~ or + inside an attribute selector as a combinator', () => {
    expect(cardClassOf('.x-card[data-a~=b]')).toBe('x-card')
    expect(cardClassOf('.x-card[data-state+="x"]')).toBe('x-card')
    expect(cardClassOf('.x-card[data-a~=b] .thumb')).toBeNull()
  })

  it('exempts option tiles and admits containers by name', () => {
    const opts = { optionTiles: new Set(['role-card']), containers: new Set(['form-panel']) }
    expect(cardClassOf('.role-card', opts)).toBeNull()
    expect(cardClassOf('.form-panel', opts)).toBe('form-panel')
    expect(cardClassOf('.form-panel')).toBeNull()
  })
})

describe('isCardRadius — equivalent spellings of the 0.75rem corner', () => {
  it('accepts 0.75rem and its equivalents', () => {
    for (const v of ['0.75rem', '.75rem', '0.750rem', '12px', '0.75rem !important']) {
      expect(isCardRadius(v), v).toBe(true)
    }
  })

  it('rejects em, which is only 12px when the font size happens to be 16px', () => {
    expect(isCardRadius('0.75em')).toBe(false)
  })

  it('accepts a card with flat edges, as long as one corner is the card corner', () => {
    expect(isCardRadius('0.75rem 0.75rem 0 0')).toBe(true)
    expect(isCardRadius('0 0 12px 12px')).toBe(true)
    expect(isCardRadius('0.75rem / 0.75rem')).toBe(true)
  })

  it('rejects every other corner, including a fully square one', () => {
    for (const v of ['0.5rem', '8px', '6px', '999px', '50%', '0', '0 0 0 0', 'inherit', 'var(--radius-card)', '0.75rem 0.5rem']) {
      expect(isCardRadius(v), v).toBe(false)
    }
  })
})

describe('cardRules — scanning a stylesheet', () => {
  it('reports a drifted card with its line, and passes a correct one', () => {
    expect(css('.a-card {\n  padding: 1rem;\n  border-radius: 0.5rem;\n}')).toEqual([
      { line: 3, card: 'a-card', radius: '0.5rem', ok: false },
    ])
    expect(css('.a-card { border-radius: 0.75rem; }')).toEqual([{ line: 1, card: 'a-card', radius: '0.75rem', ok: true }])
  })

  it('ignores a card rule that sets no radius', () => {
    expect(css('.a-card { background: var(--c-111111); }')).toEqual([])
    expect(css('.a-card--active { border-radius: 0; }')).toEqual([])
  })

  it('lets the last border-radius declaration win, as the cascade does', () => {
    expect(css('.q-card { border-radius: 0.5rem; border-radius: 0.75rem }')[0].ok).toBe(true)
    const r = css('.q-card {\n  border-radius: 0.75rem;\n  border-radius: 0.5rem;\n}')[0]
    expect(r.ok).toBe(false)
    expect(r.line).toBe(3)
  })

  it('does not judge a descendant rule as the card', () => {
    expect(css('.venue-card .map { border-radius: 0.25rem; }')).toEqual([])
  })

  it('skips comments, keeping line numbers true', () => {
    expect(css('/* .old-card { border-radius: 8px } */\n.a-card { border-radius: 0.75rem; }')).toEqual([
      { line: 2, card: 'a-card', radius: '0.75rem', ok: true },
    ])
  })

  it('judges a card that nests its own states, without counting the nested block', () => {
    const nested = '.a-card {\n  border-radius: 8px;\n  &:hover { opacity: 1 }\n}'
    expect(css(nested)).toEqual([{ line: 2, card: 'a-card', radius: '8px', ok: false }])
    // The nested state block is a card rule too, and its own radius is judged.
    expect(css('.a-card {\n  padding: 0;\n  &.is-open { border-radius: 0.5rem }\n}')).toEqual([
      { line: 3, card: 'a-card', radius: '0.5rem', ok: false },
    ])
  })

  it('does not treat a nested descendant as the card', () => {
    expect(css('.a-card {\n  border-radius: 0.75rem;\n  .map { border-radius: 4px }\n  img { border-radius: 2px }\n}')).toEqual([
      { line: 2, card: 'a-card', radius: '0.75rem', ok: true },
    ])
  })

  it('reads nested rules inside @media', () => {
    expect(css('@media (max-width: 600px) {\n  .a-card {\n    border-radius: 8px;\n  }\n}')).toEqual([
      { line: 3, card: 'a-card', radius: '8px', ok: false },
    ])
  })

  it('reads only the <style> blocks of a .vue file, with file line numbers', () => {
    const sfc = [
      '<template>',
      '  <div class="x-card" style="border-radius: 4px" />',
      '</template>',
      '<script setup lang="ts">',
      'const css = ".x-card { border-radius: 2px }"',
      '</script>',
      '<style scoped>',
      '.x-card {',
      '  border-radius: 0.5rem;',
      '}',
      '</style>',
    ].join('\n')
    expect(vue(sfc)).toEqual([{ line: 9, card: 'x-card', radius: '0.5rem', ok: false }])
  })

  it('passes option tiles and containers through to the selector test', () => {
    const opts = { optionTiles: new Set(['role-card']), containers: new Set(['scan-log']) }
    expect(css('.role-card { border-radius: 0.5rem; } .scan-log { border-radius: 0.5rem; }', opts)).toEqual([
      { line: 1, card: 'scan-log', radius: '0.5rem', ok: false },
    ])
  })
})
