import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { SENTINELS, classSelectors, fixtureTest, sentinelIn, sourceDirectives, strayReason, strayRules } from './css-sources.mjs'

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

  it('survives a ) inside a url, quoted or not', () => {
    expect(classSelectors('.a{background:url("x)y")}.b{x:y}.c{x:y}')).toEqual(['.a', '.b', '.c'])
    expect(classSelectors(".a{background:url(data:image/svg+xml,%3Csvg fill='rgb(0,0,0)'%3E)}.b{x:y}.c{x:y}")).toEqual(['.a', '.b', '.c'])
  })

  it('does not take an escaped quote in a selector for a string opening', () => {
    // Tailwind escapes the quotes of content-['…'] into the selector; the rules after it must still be seen.
    expect(classSelectors(".after\\:content-\\[\\'…\\'\\]:after{content:\"…\"}.x{a:b}.y{c:d}"))
      .toEqual([".after\\:content-\\[\\'…\\'\\]:after", '.x', '.y'])
  })

  it('loses nothing to a stray apostrophe', () => {
    expect(classSelectors(".a{--note:it's}\n.b{x:y}\n.c{x:y}")).toEqual(['.a', '.b', '.c'])
    expect(classSelectors(".a{--note:it's} /* } */.b{x:y}")).toEqual(['.a', '.b'])
  })

  it('finds a sentinel behind an escaped bracket in a merged list', () => {
    expect(sentinelIn(classSelectors(".before\\:content-\\[\\'\\(\\'\\],.flex{display:flex}"))).toBe('.flex')
  })

  it('keeps a selector whose class sits behind an element or attribute compound, as a custom variant emits', () => {
    expect(classSelectors('[data-admin-theme=light] .light\\:bg-\\[\\#…\\]{x:y}html .x{x:y}[dir=rtl]{x:y}[x="a.b"]{x:y}[x=0.5]{x:y}'))
      .toEqual(['[data-admin-theme=light] .light\\:bg-\\[\\#…\\]', 'html .x'])
    expect(strayRules(classSelectors('[data-admin-theme=light] .light\\:bg-\\[\\#…\\]{x:y}'))).toHaveLength(1)
  })

  it('keeps a minifier-merged list when any compound in it is a class', () => {
    expect(classSelectors('dialog,.rounded-card{x:y}[hidden],.\\[--radius-card\\:4px\\]{x:y}html,body{x:y}'))
      .toEqual(['dialog,.rounded-card', '[hidden],.\\[--radius-card\\:4px\\]'])
  })

  it('sees a rule behind a comment, as in an unminified build', () => {
    expect(classSelectors('/* header */\n.a {\n  x: y;\n}\n/* ; { */ .b { x: y }')).toEqual(['.a', '.b'])
  })
})

describe('sentinelIn', () => {
  it('finds a sentinel on its own and inside a minifier-merged selector list', () => {
    expect(sentinelIn(['.rounded-card'])).toBe('.rounded-card')
    expect(sentinelIn(['.x,.flex', '.y'])).toBe('.flex')
    expect(sentinelIn(['.hidden, .x'])).toBe('.hidden')
    expect(sentinelIn(classSelectors('dialog,.grid{x:y}'))).toBe('.grid')
    expect(SENTINELS).toContain('.rounded-card')
  })

  it('does not take a lookalike for one', () => {
    expect(sentinelIn(['.rounded-card-note', '.x .flex', '.md\\:hidden', '.grids', '.a:is(.b,.flex)'])).toBeNull()
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

  it('names a class that sets the card token, in a merged list too', () => {
    expect(strayReason('.\\[--radius-card\\:4px\\]')).toMatch(/--radius-card/)
    expect(strayReason('.md\\:\\[--radius-card\\:0\\.5rem\\]')).toMatch(/--radius-card/)
    expect(strayRules(classSelectors('[hidden],.\\[--radius-card\\:4px\\]{x:y}'))).toHaveLength(1)
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
  const root = (css: string) => sourceDirectives(css).roots[0]

  it('reads source(none) and the @source lines, not or otherwise', () => {
    const css = '@import "tailwindcss" source(none);\n@import "./x.css";\n@source "../src";\n@source not "../src/**/*.spec.ts";\n'
    expect(sourceDirectives(css)).toEqual({
      roots: [{ directive: '@import "tailwindcss"', detection: 'none', base: null }],
      sources: [{ path: '../src', not: false, inline: false }, { path: '../src/**/*.spec.ts', not: true, inline: false }],
    })
  })

  it('reports a bare import as automatic detection and a quoted value as a path — even "none"', () => {
    expect(root('@import "tailwindcss";')).toMatchObject({ detection: 'auto', base: null })
    expect(root("@import 'tailwindcss' source('../src');")).toMatchObject({ detection: 'path', base: '../src' })
    expect(root('@import "tailwindcss" source("none");')).toMatchObject({ detection: 'path', base: 'none' })
    expect(root('@import "tailwindcss" source( none );')).toMatchObject({ detection: 'none' })
  })

  it('allows the other import clauses, in any order', () => {
    expect(root('@import "tailwindcss" source(none) layer(tw);')).toMatchObject({ detection: 'none' })
    expect(root('@import "tailwindcss" prefix(tw) source(none);')).toMatchObject({ detection: 'none' })
    expect(root('@import "tailwindcss" theme(static) prefix(tw);')).toMatchObject({ detection: 'auto' })
  })

  it('lists every root: a second import, the split utilities import and a @tailwind directive', () => {
    const css = '@import "tailwindcss" source(none);\n@import "tailwindcss";\n@tailwind utilities;\n@import "tailwindcss/utilities.css" layer(utilities);\n@import "tailwindcss/utilities";'
    expect(sourceDirectives(css).roots.map((r: { directive: string; detection: string }) => `${r.directive} ${r.detection}`)).toEqual([
      '@import "tailwindcss" none',
      '@import "tailwindcss" auto',
      '@tailwind utilities auto',
      '@import "tailwindcss/utilities.css" auto',
      '@import "tailwindcss/utilities" auto',
    ])
    expect(sourceDirectives('@import "tailwindcss/theme.css";\n@reference "tailwindcss";').roots).toEqual([])
  })

  it('reads a source() clause on a @tailwind directive too', () => {
    expect(sourceDirectives('@tailwind utilities source(none);').roots).toEqual([{ directive: '@tailwind utilities', detection: 'none', base: null }])
    expect(sourceDirectives('@tailwind utilities source("../../e2e");').roots).toEqual([{ directive: '@tailwind utilities', detection: 'path', base: '../../e2e' }])
  })

  it('does not take a v3 @tailwind base or components for a root — they emit no utilities', () => {
    expect(sourceDirectives('@tailwind base;\n@tailwind components;').roots).toEqual([])
  })
})

describe('fixtureTest', () => {
  it('derives a file-name test from the not-globs of a source list, and nothing else', () => {
    const isFixture = fixtureTest([{ path: '../src', not: false }, { path: '../src/**/*.spec.ts', not: true }, { path: '../**/*.test.ts', not: true }])
    expect(isFixture('utils/cssSourcesCanary.spec.ts')).toBe(true)
    expect(isFixture('lib/cms.test.ts')).toBe(true)
    expect(isFixture('a.spec.ts')).toBe(true)
    for (const p of ['utils/x.ts', 'spec.ts', 'x.spec.tsx', 'components/x.vue', 'x.spec.ts.bak', 'deep/dir.spec.ts/file.ts']) expect(isFixture(p)).toBe(false)
    expect(fixtureTest([{ path: '../src', not: false }])('a.spec.ts')).toBe(false)
  })

  it('refuses a not-source that is not a **/<file pattern>, which would name every file', () => {
    expect(() => fixtureTest([{ path: '../src/fixtures/**', not: true }])).toThrow(/file pattern/)
    expect(() => fixtureTest([{ path: '../src/fixtures/*.ts', not: true }])).toThrow(/file pattern/)
    expect(() => fixtureTest([{ path: '../**/*', not: true }])).toThrow(/file pattern/)
  })

  it('reads an inline() safelist as a source', () => {
    expect(sourceDirectives('@source inline("bg-[#…] rounded-xl");\n@source not inline("p-4");').sources).toEqual([
      { path: 'bg-[#…] rounded-xl', not: false, inline: true },
      { path: 'p-4', not: true, inline: true },
    ])
  })

  it('does not take the /**/ inside a glob for a comment', () => {
    expect(sourceDirectives('@source not "../src/**/*.spec.ts";').sources).toEqual([{ path: '../src/**/*.spec.ts', not: true, inline: false }])
    expect(sourceDirectives('@source "../a/*b";\n@source "../c";').sources.map((s: { path: string }) => s.path)).toEqual(['../a/*b', '../c'])
  })

  it('ignores comments and a missing import', () => {
    expect(sourceDirectives('/* @import "tailwindcss"; @source "../e2e"; */\n@import "tailwindcss" source(none);'))
      .toEqual({ roots: [{ directive: '@import "tailwindcss"', detection: 'none', base: null }], sources: [] })
    expect(sourceDirectives('.a{x:y}')).toEqual({ roots: [], sources: [] })
  })
})
