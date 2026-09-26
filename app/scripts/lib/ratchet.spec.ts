import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain .mjs build script, no types
import { coveredBy, isScannable, MIGRATED } from './ratchet.mjs'

/**
 * What is left after the parser was deleted.
 *
 * The list used to be read out of check-admin-strings.mjs by hand, and four
 * attempts at that parse failed silently — see the docstring on MIGRATED. An
 * import cannot, so the cases worth keeping are the two rules the guards share.
 */
describe('MIGRATED', () => {
  it('is a non-empty list of relative paths', () => {
    expect(Array.isArray(MIGRATED)).toBe(true)
    expect(MIGRATED.length).toBeGreaterThan(0)
    for (const p of MIGRATED as string[]) {
      expect(p).not.toMatch(/^[./]/)
      expect(p).not.toMatch(/\\/)
      expect(p.trim()).toBe(p)
    }
  })

  it('holds no duplicates', () => {
    // A duplicate is harmless to `covered()` and a real signal that two PRs
    // added the same path, which is worth seeing.
    expect([...new Set(MIGRATED as string[])]).toHaveLength((MIGRATED as string[]).length)
  })

  it('keeps its directory entries', () => {
    // The bug that started this: a parser requiring a file extension dropped
    // these four, and the ten files under them silently left the ratchet.
    const dirs = (MIGRATED as string[]).filter((p) => !/\.(vue|ts)$/.test(p))
    expect(dirs).toContain('components/rig')
    expect(dirs).toContain('components/setlist')
    expect(dirs).toContain('components/band-member')
    expect(dirs).toContain('components/admin/forms/blocks')
  })

  it('does not list a path that another entry already covers', () => {
    const covered = coveredBy((MIGRATED as string[]).filter((p) => !/\.(vue|ts)$/.test(p)))
    for (const p of (MIGRATED as string[]).filter((p) => /\.(vue|ts)$/.test(p))) {
      expect(covered(p), `${p} is already covered by a directory entry`).toBe(false)
    }
  })
})

describe('coveredBy', () => {
  const covered = coveredBy(['App.vue', 'components/rig'])

  it('matches an exact entry and anything under a directory entry', () => {
    expect(covered('App.vue')).toBe(true)
    expect(covered('components/rig/RigBackline.vue')).toBe(true)
    expect(covered('components/rig/nested/Deep.vue')).toBe(true)
  })

  it('does not match a sibling that merely shares a prefix', () => {
    expect(covered('components/rigging/X.vue')).toBe(false)
    expect(covered('App.vue.bak')).toBe(false)
    expect(covered('other/App.vue')).toBe(false)
  })
})

describe('isScannable', () => {
  it('takes .vue and .ts', () => {
    expect(isScannable('src/App.vue')).toBe(true)
    expect(isScannable('src/utils/x.ts')).toBe(true)
  })

  it('never takes a spec', () => {
    // check-admin-strings disagreed with its two siblings here: a directory
    // entry pulled specs in, and the only remedy it could offer a test was
    // "move the assertion into the i18n catalogue".
    expect(isScannable('src/utils/x.spec.ts')).toBe(false)
    expect(isScannable('src/components/rig/RigBackline.spec.ts')).toBe(false)
  })

  it('ignores everything else', () => {
    expect(isScannable('src/styles/app.css')).toBe(false)
    expect(isScannable('src/assets/logo.svg')).toBe(false)
    expect(isScannable('README.md')).toBe(false)
  })
})
