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

const DQ = String.fromCharCode(34)
const BS = String.fromCharCode(92)
const TICK = String.fromCharCode(96)
const NLQ = String.fromCharCode(10)

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

  it('reads a double-quoted entry, rather than dropping it silently', () => {
    // The scanner used to consume a double-quoted string and collect only
    // single-quoted ones, so one Prettier run with `singleQuote: false` would
    // drop entries — and unlike every other bug here that one failed *open*,
    // quietly un-ratcheting whatever it lost.
    const src = wrap("  'A.vue'," + NLQ + "  " + DQ + "B.vue" + DQ + "," + NLQ + "  'C.vue',")
    expect(migratedPaths(lint(src))).toEqual(['A.vue', 'B.vue', 'C.vue'])
  })

  it('handles an escaped quote inside a path', () => {
    const src = wrap("  'O" + BS + "'Brien.vue'," + NLQ + "  'B.vue',")
    expect(migratedPaths(lint(src))).toEqual(["O'Brien.vue", 'B.vue'])
  })

  it('refuses a template literal rather than guessing at it', () => {
    const src = wrap("  'A.vue'," + NLQ + "  " + TICK + "B.vue" + TICK + ",")
    expect(() => migratedPaths(lint(src))).toThrow(/template literal/)
  })

  it('is not fooled by a declaration written inside a comment', () => {
    // The bracket count used to start from a bracket that was itself commented
    // out, so a well-formed array was reported as unterminated.
    const src = "// const MIGRATED = [ see below" + NLQ + wrap("  'A.vue',")
    expect(migratedPaths(lint(src))).toEqual(['A.vue'])
  })

  it('throws rather than returning a short list when the array is unterminated', () => {
    // Failing loudly is the whole point: a short list silently un-ratchets files.
    expect(() => migratedPaths(lint("const MIGRATED = [\n  'A.vue',\n"))).toThrow(/unterminated/)
  })

  it('fails closed, not short, on a regex literal holding an odd quote', () => {
    // The parser is not a JS lexer and cannot tell `/.../` from division, so
    // `/[^']/` reads as the start of a string. What matters is the direction of
    // the failure: it throws, and both guards exit 1 on a throw, so the list is
    // never silently short. check-admin-strings.mjs has no such regex today.
    const SLASH = String.fromCharCode(47)
    const src = 'const RX = ' + SLASH + '[^' + "'" + ']' + SLASH + 'g' + NLQ + wrap("  'A.vue',")
    expect(() => migratedPaths(lint(src))).toThrow(/unterminated string/)
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
