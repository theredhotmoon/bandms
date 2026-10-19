import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { SENTINEL, classSelectors, sourceDirectives, strayReason, strayRules } from './css-sources.mjs'

describe('classSelectors', () => {
  it('lists class rules at the top level and inside at-rules', () => {
    expect(classSelectors('.a{color:red}@media (hover:hover){.b:hover{color:blue}}.c .d{x:y}'))
      .toEqual(['.a', '.b:hover', '.c .d'])
  })

  it('keeps escaped utility names whole', () => {
    expect(classSelectors('.hover\\:bg-\\[\\#333\\]:hover{color:red}.\\[--radius-card\\:4px\\]{--radius-card:4px}'))
      .toEqual(['.hover\\:bg-\\[\\#333\\]:hover', '.\\[--radius-card\\:4px\\]'])
  })

  it('skips element, root and at-rule heads', () => {
    expect(classSelectors(':root{--x:1}@layer base{*,:after{box-sizing:border-box}html{margin:0}}.ok{x:y}')).toEqual(['.ok'])
  })

  it('does not take a brace or semicolon inside a string or a url() for a rule boundary', () => {
    expect(classSelectors('.a:after{content:"};{"}.b{background:url(data:image/svg+xml;utf8,<svg>{…}</svg>)}.c{x:y}'))
      .toEqual(['.a:after', '.b', '.c'])
    expect(classSelectors(".q[data-x='a;b']{x:y}")).toEqual([".q[data-x='a;b']"])
  })

  it('does not take an escaped quote in a selector for a string opening', () => {
    // Tailwind escapes the quotes of content-['…'] into the selector; the rules after it must still be seen.
    expect(classSelectors(".after\\:content-\\[\\'…\\'\\]:after{content:\"…\"}.x{a:b}.y{c:d}"))
      .toEqual([".after\\:content-\\[\\'…\\'\\]:after", '.x', '.y'])
  })

  it('sees a rule behind a comment, as in an unminified build', () => {
    expect(classSelectors('/* header */\n.a {\n  x: y;\n}\n/* ; { */ .b { x: y }')).toEqual(['.a', '.b'])
  })

  it('finds the sentinel in real Tailwind output', () => {
    expect(classSelectors('.rounded-card{border-radius:var(--radius-card)}')).toEqual([SENTINEL])
  })
})

describe('strayReason', () => {
  it('names the documentation placeholder when it is the whole arbitrary value', () => {
    expect(strayReason('.bg-\\[\\#…\\]')).toMatch(/placeholder/)
    expect(strayReason('.\\[--radius-card\\:…\\]')).toMatch(/placeholder/)
  })

  it('lets a real value carry an ellipsis', () => {
    expect(strayReason(".after\\:content-\\[\\'…\\'\\]:after")).toBeNull()
    expect(strayReason('.truncate-…-note')).toBeNull()
  })

  it('names a class that sets the card token', () => {
    expect(strayReason('.\\[--radius-card\\:4px\\]')).toMatch(/--radius-card/)
    expect(strayReason('.md\\:\\[--radius-card\\:0\\.5rem\\]')).toMatch(/--radius-card/)
  })

  it('passes what a component can produce', () => {
    for (const s of ['.rounded-card', '.bg-\\[\\#141414\\]', '.hover\\:rounded-tl-card:hover', '.card', '.radius-card-note'])
      expect(strayReason(s)).toBeNull()
  })
})

describe('strayRules', () => {
  it('returns the leaked rules with their reasons, in order', () => {
    const selectors = classSelectors('.a{x:y}.bg-\\[\\#…\\]{background-color:#…}.b{x:y}.\\[--radius-card\\:4px\\]{--radius-card:4px}')
    expect(strayRules(selectors).map((r: { selector: string }) => r.selector))
      .toEqual(['.bg-\\[\\#…\\]', '.\\[--radius-card\\:4px\\]'])
  })

  it('is empty for a clean stylesheet', () => {
    expect(strayRules(classSelectors('.rounded-card{border-radius:var(--radius-card)}.x-card{x:y}'))).toEqual([])
  })
})

describe('sourceDirectives', () => {
  it('reads source(none) and the @source lines, not or otherwise', () => {
    const css = '@import "tailwindcss" source(none);\n@import "./x.css";\n@source "../src";\n@source not "../src/**/*.spec.ts";\n'
    expect(sourceDirectives(css)).toEqual({
      imported: true,
      detection: 'none',
      sources: [{ path: '../src', not: false }, { path: '../src/**/*.spec.ts', not: true }],
    })
  })

  it('reports a bare import as automatic detection and a quoted base as itself', () => {
    expect(sourceDirectives('@import "tailwindcss";').detection).toBe('auto')
    expect(sourceDirectives("@import 'tailwindcss' source('../src');").detection).toBe('../src')
    expect(sourceDirectives('@import "tailwindcss" source( none );').detection).toBe('none')
  })

  it('does not take the /**/ inside a glob, or a comment marker inside any string, for a comment', () => {
    expect(sourceDirectives('@source not "../src/**/*.spec.ts";').sources).toEqual([{ path: '../src/**/*.spec.ts', not: true }])
    expect(sourceDirectives('@source "../a/*b";\n@source "../c";').sources.map((s: { path: string }) => s.path)).toEqual(['../a/*b', '../c'])
  })

  it('ignores comments and a missing import', () => {
    expect(sourceDirectives('/* @import "tailwindcss"; @source "../e2e"; */\n@import "tailwindcss" source(none);'))
      .toEqual({ imported: true, detection: 'none', sources: [] })
    expect(sourceDirectives('.a{x:y}')).toEqual({ imported: false, detection: null, sources: [] })
  })
})
