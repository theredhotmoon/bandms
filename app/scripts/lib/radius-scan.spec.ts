import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { UTILITY_CARD, cardClassOf, cardRules, cornersOf, isCardCorners, isCardRadius, judge, scanCards, tokenDefinitions, utilityCardLiterals } from './radius-scan.mjs'

type Rule = { line: number; card: string; radius: string; ok: boolean; literal?: true }
const css = (src: string, opts?: object): Rule[] => cardRules(src, 'css', opts)
const vue = (src: string, opts?: object): Rule[] => cardRules(src, 'vue', opts)
const T = 'var(--radius-card)'

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
  })

  it('looks inside :deep(), :global(), :is() and :where() and judges their last compound', () => {
    expect(cardClassOf(':deep(.x-card)')).toBe('x-card')
    expect(cardClassOf(':deep(.x-card .thumb)')).toBeNull()
    expect(cardClassOf(':deep(.list .x-card)')).toBe('x-card')
    expect(cardClassOf(':global(.x-card img)')).toBeNull()
    expect(cardClassOf(':is(.x-card, .pill)')).toBe('x-card')
    expect(cardClassOf(':is(.a .x-card .b)')).toBeNull()
    expect(cardClassOf('.wrap :where(.x-card)')).toBe('x-card')
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

describe('isCardRadius — what a card rule may write', () => {
  it('accepts the token, however it is spaced, with or without !important', () => {
    for (const v of [T, 'var( --radius-card )', `${T} !important`, `${T} ! important`]) {
      expect(isCardRadius(v), v).toBe(true)
    }
  })

  it('accepts one flat edge, as long as the other two corners are the token', () => {
    expect(isCardRadius(`${T} ${T} 0 0`)).toBe(true)
    expect(isCardRadius(`0 0 ${T} ${T}`)).toBe(true)
    expect(isCardRadius(`0 ${T} ${T} 0`)).toBe(true)
    expect(isCardRadius(`${T} / ${T}`)).toBe(true)
  })

  it('rejects the literal 0.75rem and its equivalents — the right shape, not the token', () => {
    for (const v of ['0.75rem', '.75rem', '0.750rem', '12px', '0.75rem !important', '0.75rem 0.75rem 0 0', '0 0 12px 12px', `${T} / 12px`, `${T} 12px`]) {
      expect(isCardRadius(v), v).toBe(false)
      expect(judge([['border-radius', v]]), v).toEqual({ shape: true, literal: true, ok: false })
    }
  })

  it('rejects two square corners on a diagonal, a fully square card, and every other corner', () => {
    for (const v of [`${T} 0`, '0.5rem', '8px', '6px', '999px', '50%', '0', '0 0 0 0', 'inherit', 'var(--radius-md)', `${T} 0.5rem`, `${T} / 0.5rem`, '8px ! important']) {
      expect(isCardRadius(v), v).toBe(false)
      expect(judge([['border-radius', v]]).shape, v).toBe(false)
    }
  })

  it('rejects em, which is only 12px when the font size happens to be 16px', () => {
    expect(isCardRadius('0.75em')).toBe(false)
  })
})

describe('cornersOf — resolving shorthand and longhands in cascade order', () => {
  it('expands the shorthand like CSS does', () => {
    expect(cornersOf([['border-radius', '1px 2px 3px 4px']])).toEqual([1, 2, 3, 4])
    expect(cornersOf([['border-radius', '1px 2px 3px']])).toEqual([1, 2, 3, 2])
    expect(cornersOf([['border-radius', '1px 2px']])).toEqual([1, 2, 1, 2])
    expect(cornersOf([['border-radius', T]])).toEqual([12, 12, 12, 12])
  })

  it('applies longhands over an earlier shorthand, physical and logical', () => {
    const decls: [string, string][] = [
      ['border-radius', '8px'],
      ['border-top-left-radius', T],
      ['border-start-end-radius', T],
      ['border-end-end-radius', T],
      ['border-bottom-left-radius', T],
    ]
    expect(cornersOf(decls)).toEqual([12, 12, 12, 12])
    expect(judge(decls)).toEqual({ shape: true, literal: false, ok: true })
  })

  it('treats longhands alone as the other corners being 0', () => {
    expect(cornersOf([['border-start-start-radius', T]])).toEqual([12, 0, 0, 0])
    // Two top corners rounded is a flat bottom edge; two on a diagonal is not an edge.
    expect(isCardCorners(cornersOf([['border-top-left-radius', T], ['border-top-right-radius', T]]))).toBe(true)
    expect(isCardCorners(cornersOf([['border-top-left-radius', T], ['border-bottom-right-radius', T]]))).toBe(false)
  })

  it('lets a later shorthand reset earlier longhands', () => {
    expect(cornersOf([['border-top-left-radius', '0'], ['border-radius', T]])).toEqual([12, 12, 12, 12])
  })

  it('calls one literal longhand among token corners a literal', () => {
    expect(judge([['border-radius', T], ['border-top-left-radius', '12px']])).toEqual({ shape: true, literal: true, ok: false })
    expect(judge([['border-radius', '0.75rem'], ['border-radius', T]])).toEqual({ shape: true, literal: false, ok: true })
  })
})

describe('cardRules — scanning a stylesheet', () => {
  it('reports a drifted card with its line, and passes a correct one', () => {
    expect(css('.a-card {\n  padding: 1rem;\n  border-radius: 0.5rem;\n}')).toEqual([
      { line: 3, card: 'a-card', radius: '0.5rem', ok: false },
    ])
    expect(css(`.a-card { border-radius: ${T}; }`)).toEqual([{ line: 1, card: 'a-card', radius: T, ok: true }])
  })

  it('reports a card written with the literal 0.75rem as a literal, so the guard can say so', () => {
    expect(css('.a-card { border-radius: 0.75rem; }')).toEqual([{ line: 1, card: 'a-card', radius: '0.75rem', ok: false, literal: true }])
    expect(css('.a-card { border-radius: 0.5rem; }')[0]).not.toHaveProperty('literal')
    expect(css('.a-card { border-radius: var(--radius-md); }')).toEqual([{ line: 1, card: 'a-card', radius: 'var(--radius-md)', ok: false }])
  })

  it('ignores a card rule that sets no radius', () => {
    expect(css('.a-card { background: var(--c-111111); }')).toEqual([])
    expect(css('.a-card--active { border-radius: 0; }')).toEqual([])
  })

  it('lets the last border-radius declaration win, as the cascade does', () => {
    expect(css(`.q-card { border-radius: 0.5rem; border-radius: ${T} }`)[0].ok).toBe(true)
    const r = css(`.q-card {\n  border-radius: ${T};\n  border-radius: 0.5rem;\n}`)[0]
    expect(r.ok).toBe(false)
    expect(r.line).toBe(3)
  })

  it('reads longhand corners and reports them by property', () => {
    const all = '.a-card { border-top-left-radius: 8px; border-top-right-radius: 8px; border-bottom-right-radius: 8px; border-bottom-left-radius: 8px }'
    expect(css(all)[0]).toMatchObject({ card: 'a-card', ok: false })
    expect(css(all)[0].radius).toContain('border-top-left-radius: 8px')
    expect(css(`.a-card { border-radius: ${T}; border-bottom-left-radius: 0; border-bottom-right-radius: 0 }`)[0].ok).toBe(true)
    expect(css(`.a-card { border-radius: 8px; border-top-left-radius: ${T}; border-top-right-radius: ${T}; border-bottom-right-radius: ${T}; border-bottom-left-radius: ${T} }`)[0].ok).toBe(true)
    expect(css('.a-card { border-radius: 8px; border-top-left-radius: 12px; border-top-right-radius: 12px; border-bottom-right-radius: 12px; border-bottom-left-radius: 12px }')[0]).toMatchObject({ ok: false, literal: true })
  })

  it('does not mistake a custom property or a vendor prefix for the radius', () => {
    expect(css(`.a-card { border-radius: ${T}; --thumb-border-radius: 4px }`)).toEqual([
      { line: 1, card: 'a-card', radius: T, ok: true },
    ])
    expect(css(`.a-card { -webkit-border-radius: 4px; border-radius: ${T} }`)[0].ok).toBe(true)
  })

  it('skips a declaration line that carries radius-lint-ignore', () => {
    const src = `@media (max-width: 480px) {\n  .a-card { border-radius: 0; } /* radius-lint-ignore: flush to the viewport edge */\n}\n.a-card { border-radius: ${T} }`
    expect(css(src)).toEqual([{ line: 4, card: 'a-card', radius: T, ok: true }])
  })

  it('does not judge a descendant rule as the card', () => {
    expect(css('.venue-card .map { border-radius: 0.25rem; }')).toEqual([])
    expect(css(':deep(.rp-card img) { border-radius: 4px; }')).toEqual([])
  })

  it('skips comments, keeping line numbers true', () => {
    expect(css(`/* .old-card { border-radius: 8px } */\n.a-card { border-radius: ${T}; }`)).toEqual([
      { line: 2, card: 'a-card', radius: T, ok: true },
    ])
  })

  it('is not derailed by braces inside strings or url()', () => {
    const src = ".x-card::before { content: '}' }\n.x-card { border-radius: 6px }"
    expect(css(src)).toEqual([{ line: 2, card: 'x-card', radius: '6px', ok: false }])
    const uri = '.bg { background: url("data:image/svg+xml;utf8,<svg>{}</svg>") }\n.x-card { border-radius: 6px }'
    expect(css(uri)).toEqual([{ line: 2, card: 'x-card', radius: '6px', ok: false }])
    expect(css(`.bg { background: url(data:x;{) }\n.x-card { border-radius: ${T} }`)[0].ok).toBe(true)
  })

  it('judges a card that nests its own states, without counting the nested block', () => {
    const nested = '.a-card {\n  border-radius: 8px;\n  &:hover { opacity: 1 }\n}'
    expect(css(nested)).toEqual([{ line: 2, card: 'a-card', radius: '8px', ok: false }])
    expect(css('.a-card {\n  padding: 0;\n  &.is-open { border-radius: 0.5rem }\n}')).toEqual([
      { line: 3, card: 'a-card', radius: '0.5rem', ok: false },
    ])
  })

  it('does not treat a nested descendant as the card', () => {
    expect(css(`.a-card {\n  border-radius: ${T};\n  .map { border-radius: 4px }\n  img { border-radius: 2px }\n}`)).toEqual([
      { line: 2, card: 'a-card', radius: T, ok: true },
    ])
  })

  it('judges a @media override nested inside the card as the card', () => {
    const src = `.a-card {\n  border-radius: ${T};\n  @media (max-width: 600px) { border-radius: 8px }\n}`
    expect(css(src)).toEqual([
      { line: 2, card: 'a-card', radius: T, ok: true },
      { line: 3, card: 'a-card', radius: '8px', ok: false },
    ])
    expect(css('.a-card { @media (max-width: 600px) { & { border-radius: 8px } } }')).toEqual([
      { line: 1, card: 'a-card', radius: '8px', ok: false },
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

  it('does not let a self-closing <style src> swallow the real block', () => {
    const sfc = [
      '<template><div /></template>',
      '<style scoped src="./form-styles.css" />',
      '<style scoped>',
      '.x-card { border-radius: 0.5rem; }',
      '</style>',
    ].join('\n')
    expect(vue(sfc)).toEqual([{ line: 4, card: 'x-card', radius: '0.5rem', ok: false }])
  })

  it('ignores a <style> block inside an HTML comment, and a "<!--" string in script', () => {
    const sfc = `<template>\n<!-- <style>.b-card{border-radius:4px}</style> -->\n<div />\n</template>\n<style>.a-card { border-radius: ${T} }</style>`
    expect(vue(sfc)).toEqual([{ line: 5, card: 'a-card', radius: T, ok: true }])
    const tricky = "<script setup>\nconst OPEN = '<!--'\nconst CLOSE = '-->'\n</script>\n<style>.a-card { border-radius: 4px }</style>"
    expect(vue(tricky)).toEqual([{ line: 5, card: 'a-card', radius: '4px', ok: false }])
  })

  it('passes option tiles and containers through to the selector test', () => {
    const opts = { optionTiles: new Set(['role-card']), containers: new Set(['scan-log']) }
    expect(css('.role-card { border-radius: 0.5rem; } .scan-log { border-radius: 0.5rem; }', opts)).toEqual([
      { line: 1, card: 'scan-log', radius: '0.5rem', ok: false },
    ])
  })
})

describe('scanCards — which listed classes still name a rule', () => {
  it('reports a listed class only when it is the last compound of a real rule', () => {
    const opts = { optionTiles: new Set(['role-card']), containers: new Set(['scan-log', 'gone']) }
    const src = '/* .gone { } */\n.gone .row { padding: 0 }\n.scan-log { border: 0 }\n.role-card { padding: 0 }'
    expect([...scanCards(src, 'css', opts).classes].sort()).toEqual(['role-card', 'scan-log'])
  })
})

describe('tokenDefinitions — where --radius-card is set', () => {
  it('finds every definition with its line and value, in a @theme block or a plain rule', () => {
    const src = '@theme static {\n  --radius-card: 0.75rem;\n}\n:root[data-admin-theme="light"] {\n  --radius-card: 0.5rem;\n}'
    expect(tokenDefinitions(src, 'css')).toEqual([
      { line: 2, value: '0.75rem' },
      { line: 5, value: '0.5rem' },
    ])
  })

  it('does not read a comment, a string or a different property as a definition', () => {
    expect(tokenDefinitions('/* --radius-card: 0.75rem */\n.a { border-radius: var(--radius-card) }', 'css')).toEqual([])
    expect(tokenDefinitions('.a::before { content: "--radius-card: 4px" }', 'css')).toEqual([])
    expect(tokenDefinitions('.a { --thumb-radius-card: 4px; --radius-card-x: 2px }', 'css')).toEqual([])
    expect(tokenDefinitions('.a { --radius-card:4px }', 'css')).toEqual([{ line: 1, value: '4px' }])
  })

  it('reads only the <style> blocks of a .vue file', () => {
    const sfc = "<script setup>\nconst k = '--radius-card: 0'\n</script>\n<template><!-- --radius-card: 1px --><div /></template>\n<style>\n.x { --radius-card: 4px }\n</style>"
    expect(tokenDefinitions(sfc, 'vue')).toEqual([{ line: 6, value: '4px' }])
  })
})

describe('utilityCardLiterals — rounded-xl in a class list', () => {
  it('finds the utility in class attributes, bindings and script constants, with the file line', () => {
    const sfc = [
      '<script setup lang="ts">',
      "const CARD = 'border rounded-xl p-4'",
      '</script>',
      '<template>',
      '  <div class="rounded-xl bg-zinc-900" />',
      '  <div :class="[open ? \'rounded-t-xl\' : \'rounded-xl\', \'md:rounded-xl\']" />',
      '  <div class="rounded-card rounded-lg rounded-2xl" />',
      '</template>',
    ].join('\n')
    expect(utilityCardLiterals(sfc)).toEqual([
      { line: 2, utility: 'rounded-xl' },
      { line: 5, utility: 'rounded-xl' },
      { line: 6, utility: 'rounded-t-xl' },
      { line: 6, utility: 'rounded-xl' },
      { line: 6, utility: 'md:rounded-xl' },
    ])
  })

  it('ignores <style> blocks and HTML comments', () => {
    const sfc = '<template>\n<!-- <div class="rounded-xl" /> -->\n<div class="rounded-card" />\n</template>\n<style>\n.rounded-xl { border-radius: 0 }\n</style>'
    expect(utilityCardLiterals(sfc)).toEqual([])
  })

  it('names the token utility after the token', () => {
    expect(UTILITY_CARD).toBe('rounded-card')
  })
})
