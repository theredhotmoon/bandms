import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { SENTINEL, classSelectors, hasSentinel, segments, sourceDirectives, strayReason, strayRules, stripComments } from './css-sources.mjs'

const types = (css: string): string[] => [...segments(css)].map((s: { type: string }) => s.type)

describe('segments', () => {
  it('splits comments, strings, unquoted urls and text, keeping every character', () => {
    const css = '/* c */.a{content:"x";background:url(a.png)}'
    expect(types(css)).toEqual(['comment', 'text', 'string', 'text', 'url', 'text'])
    expect([...segments(css)].map((s: { text: string }) => s.text).join('')).toBe(css)
  })

  it('treats a quoted url() as text plus a string, so a ) inside the quotes is not its end', () => {
    expect(types('url("x)y")')).toEqual(['text', 'string', 'text'])
  })
})

describe('stripComments', () => {
  it('removes comments and nothing else', () => {
    expect(stripComments('a/* x */b"/*"c')).toBe('ab"/*"c')
  })

  it('does not take the /**/ inside a glob for a comment', () => {
    expect(stripComments('@source not "../src/**/*.spec.ts";')).toBe('@source not "../src/**/*.spec.ts";')
  })
})

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

  it('survives a ) inside a quoted url, where the quotes rule', () => {
    expect(classSelectors('.a{background:url("x)y")}.b{x:y}.c{x:y}')).toEqual(['.a', '.b', '.c'])
    expect(classSelectors(".a{background:url('data:image/svg+xml,<svg fill=\"rgb(0,0,0)\"/>')}.b{x:y}")).toEqual(['.a', '.b'])
  })

  it('does not take an escaped quote in a selector for a string opening', () => {
    // Tailwind escapes the quotes of content-['…'] into the selector; the rules after it must still be seen.
    expect(classSelectors(".after\\:content-\\[\\'…\\'\\]:after{content:\"…\"}.x{a:b}.y{c:d}"))
      .toEqual([".after\\:content-\\[\\'…\\'\\]:after", '.x', '.y'])
  })

  it('sees a rule behind a comment, as in an unminified build', () => {
    expect(classSelectors('/* header */\n.a {\n  x: y;\n}\n/* ; { */ .b { x: y }')).toEqual(['.a', '.b'])
  })
})

describe('hasSentinel', () => {
  it('finds the sentinel on its own and inside a minifier-merged selector list', () => {
    expect(hasSentinel(['.rounded-card'])).toBe(true)
    expect(hasSentinel(['.x,.rounded-card', '.y'])).toBe(true)
    expect(hasSentinel(['.rounded-card, .x'])).toBe(true)
    expect(SENTINEL).toBe('.rounded-card')
  })

  it('does not take a lookalike for it', () => {
    expect(hasSentinel(['.rounded-card-note', '.x .rounded-card', '.md\\:rounded-card', '.rounded-cards'])).toBe(false)
  })
})

describe('strayReason', () => {
  it('names the documentation placeholder anywhere in an arbitrary value', () => {
    expect(strayReason('.bg-\\[\\#…\\]')).toMatch(/placeholder/)
    expect(strayReason('.\\[--radius-card\\:…\\]')).toMatch(/placeholder/)
    expect(strayReason('.rounded-\\[…px\\]')).toMatch(/placeholder/)
    expect(strayReason('.shadow-\\[0_0_…\\]')).toMatch(/placeholder/)
  })

  it('lets quoted content carry an ellipsis', () => {
    expect(strayReason(".after\\:content-\\[\\'…\\'\\]:after")).toBeNull()
    expect(strayReason(".content-\\[\\'a…b\\'\\]")).toBeNull()
    expect(strayReason('.content-\\[\\"…\\"\\]')).toBeNull()
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
      sources: [{ path: '../src', not: false, inline: false }, { path: '../src/**/*.spec.ts', not: true, inline: false }],
    })
  })

  it('reports a bare import as automatic detection and a quoted base as itself', () => {
    expect(sourceDirectives('@import "tailwindcss";').detection).toBe('auto')
    expect(sourceDirectives("@import 'tailwindcss' source('../src');").detection).toBe('../src')
    expect(sourceDirectives('@import "tailwindcss" source( none );').detection).toBe('none')
  })

  it('allows the other import clauses, in any order', () => {
    expect(sourceDirectives('@import "tailwindcss" source(none) layer(tw);')).toMatchObject({ imported: true, detection: 'none' })
    expect(sourceDirectives('@import "tailwindcss" prefix(tw) source(none);')).toMatchObject({ imported: true, detection: 'none' })
    expect(sourceDirectives('@import "tailwindcss" theme(static) prefix(tw);')).toMatchObject({ imported: true, detection: 'auto' })
  })

  it('reads an inline() safelist as a source', () => {
    expect(sourceDirectives('@source inline("bg-[#…] rounded-xl");\n@source not inline("p-4");').sources).toEqual([
      { path: 'bg-[#…] rounded-xl', not: false, inline: true },
      { path: 'p-4', not: true, inline: true },
    ])
  })

  it('does not take the /**/ inside a glob, or a comment marker inside any string, for a comment', () => {
    expect(sourceDirectives('@source not "../src/**/*.spec.ts";').sources).toEqual([{ path: '../src/**/*.spec.ts', not: true, inline: false }])
    expect(sourceDirectives('@source "../a/*b";\n@source "../c";').sources.map((s: { path: string }) => s.path)).toEqual(['../a/*b', '../c'])
  })

  it('ignores comments and a missing import', () => {
    expect(sourceDirectives('/* @import "tailwindcss"; @source "../e2e"; */\n@import "tailwindcss" source(none);'))
      .toEqual({ imported: true, detection: 'none', sources: [] })
    expect(sourceDirectives('.a{x:y}')).toEqual({ imported: false, detection: null, sources: [] })
  })
})
