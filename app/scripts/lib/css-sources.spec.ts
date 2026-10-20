import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { EXPECTED_SOURCES, isFixture } from './css-sources.mjs'

describe('the admin source list', () => {
  it('names src/ and index.html as sources and the specs beside the source as fixtures', () => {
    expect(EXPECTED_SOURCES).toEqual([
      { path: '../src', not: false },
      { path: '../index.html', not: false },
      { path: '../src/**/*.spec.ts', not: true },
    ])
  })
})

describe('isFixture', () => {
  it('names the src files the not-globs exclude, and nothing else', () => {
    expect(isFixture('utils/cssSourcesCanary.spec.ts')).toBe(true)
    expect(isFixture('a.spec.ts')).toBe(true)
    for (const p of ['utils/x.ts', 'spec.ts', 'x.spec.tsx', 'components/x.vue', 'x.spec.ts.bak']) expect(isFixture(p)).toBe(false)
  })
})
