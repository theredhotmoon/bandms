import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { classSelectors, strayReason, strayRules } from './css-sources.mjs'

const sel = (css: string): string[] => classSelectors(css).map((s: { selector: string }) => s.selector)

describe('classSelectors', () => {
  it('lists class rules at the top level and inside at-rules', () => {
    expect(sel('.a{color:red}@media (hover:hover){.b:hover{color:blue}}.c .d{x:y}'))
      .toEqual(['.a', '.b:hover', '.c .d'])
  })

  it('keeps escaped utility names whole', () => {
    expect(sel('.hover\\:bg-\\[\\#333\\]:hover{color:red}.\\[--radius-card\\:4px\\]{--radius-card:4px}'))
      .toEqual(['.hover\\:bg-\\[\\#333\\]:hover', '.\\[--radius-card\\:4px\\]'])
  })

  it('skips element, root and at-rule heads', () => {
    expect(sel(':root{--x:1}@layer base{*,:after{box-sizing:border-box}html{margin:0}}.ok{x:y}')).toEqual(['.ok'])
  })
})

describe('strayReason', () => {
  it('names the documentation placeholder', () => {
    expect(strayReason('.bg-\\[\\#…\\]')).toMatch(/placeholder/)
    expect(strayReason('.\\[--radius-card\\:…\\]')).toMatch(/placeholder/)
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
    const css = '.a{x:y}.bg-\\[\\#…\\]{background-color:#…}.b{x:y}.\\[--radius-card\\:4px\\]{--radius-card:4px}'
    expect(strayRules(css).map((r: { selector: string }) => r.selector))
      .toEqual(['.bg-\\[\\#…\\]', '.\\[--radius-card\\:4px\\]'])
  })

  it('is empty for a clean stylesheet', () => {
    expect(strayRules('.rounded-card{border-radius:var(--radius-card)}.x-card{x:y}')).toEqual([])
  })
})
