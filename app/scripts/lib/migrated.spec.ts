import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain .mjs build script, no types
import { coveredBy, migratedPaths } from './migrated.mjs'

/**
 * The ratchet parser has two guards depending on it and three bugs behind it,
 * every one of which failed *silently* — the list parsed short, and the guard
 * then rejected a file while telling you to add a path that was already on the
 * list. That is the shape worth pinning.
 */
const dir = mkdtempSync(join(tmpdir(), 'migrated-'))
let n = 0

function lint(body: string): string {
  const p = join(dir, `lint-${n++}.mjs`)
  writeFileSync(p, body)
  return p
}

const wrap = (inner: string) => `const MIGRATED = [\n${inner}\n]\n`

describe('migratedPaths', () => {
  it('reads plain entries', () => {
    expect(migratedPaths(lint(wrap("  'App.vue',\n  'utils/x.ts',")))).toEqual(['App.vue', 'utils/x.ts'])
  })

  it('keeps directory entries', () => {
    // The regex that required a file extension dropped these, so the ten files
    // under them were treated as unmigrated while the string lint called them
    // done — the two guards contradicting each other out loud.
    expect(migratedPaths(lint(wrap("  'components/rig',\n  'App.vue',")))).toEqual(['components/rig', 'App.vue'])
  })

  it('is not desynchronised by an apostrophe in a comment', () => {
    const src = wrap("  'A.vue',\n  // the coverage guard's import walk\n  'B.vue',")
    expect(migratedPaths(lint(src))).toEqual(['A.vue', 'B.vue'])
  })

  it('does not end the array on a bracket inside a comment', () => {
    const src = wrap("  'A.vue',\n  // end of list]\n  'B.vue',")
    expect(migratedPaths(lint(src))).toEqual(['A.vue', 'B.vue'])
  })

  it('does not end the array on a bracket inside a block comment', () => {
    const src = wrap("  'A.vue',\n  /* ] */\n  'B.vue',")
    expect(migratedPaths(lint(src))).toEqual(['A.vue', 'B.vue'])
  })

  it('does not end the array on a bracket inside a path', () => {
    expect(migratedPaths(lint(wrap("  'weird]name.vue',\n  'B.vue',")))).toEqual(['weird]name.vue', 'B.vue'])
  })

  it('ignores double-quoted and template strings, which are not paths here', () => {
    const src = wrap("  'A.vue',\n  // see \"docs\" and `notes`\n  'B.vue',")
    expect(migratedPaths(lint(src))).toEqual(['A.vue', 'B.vue'])
  })

  it('throws rather than returning a short list when the array is unterminated', () => {
    // Failing loudly is the whole point: a short list silently un-ratchets files.
    expect(() => migratedPaths(lint("const MIGRATED = [\n  'A.vue',\n"))).toThrow(/unterminated/)
  })

  it('throws when MIGRATED is absent or empty', () => {
    expect(() => migratedPaths(lint('const OTHER = []\n'))).toThrow(/could not find MIGRATED/)
    expect(() => migratedPaths(lint('const MIGRATED = [\n]\n'))).toThrow(/empty/)
  })
})

describe('coveredBy', () => {
  const covered = coveredBy(['App.vue', 'components/rig'])

  it('matches an exact entry and anything under a directory entry', () => {
    expect(covered('App.vue')).toBe(true)
    expect(covered('components/rig/RigBackline.vue')).toBe(true)
  })

  it('does not match a sibling that merely shares a prefix', () => {
    expect(covered('components/rigging/X.vue')).toBe(false)
    expect(covered('App.vue.bak')).toBe(false)
    expect(covered('other/App.vue')).toBe(false)
  })
})
