import { readFileSync } from 'node:fs'

/**
 * The MIGRATED ratchet from check-admin-strings.mjs, parsed once for everyone.
 *
 * Extracted because a third parse of the same list had already drifted. The
 * completeness guard matched a regex requiring a file extension, so the four
 * *directory* entries ('components/rig', 'components/setlist',
 * 'components/band-member', 'components/admin/forms/blocks') were silently
 * dropped and the ten files under them were treated as unmigrated. The two
 * guards then contradicted each other out loud: check-admin-strings printed
 * "110 migrated path(s), no hardcoded text" while check-i18n-complete rejected
 * RigBackline.vue and told you to add a path the ratchet already covered. It
 * also meant those ten files lost their `i18n-ignore` support, which
 * RigInputsTable.vue relies on ten times for the same persisted rig values, and
 * which only worked there because that one file happens to be listed
 * individually.
 *
 * This is the same reason template-scan.mjs is shared: two copies of a rule
 * drifting apart is the defect, not the duplication.
 */

/**
 * Scan the array with one pass that knows about comments and strings.
 *
 * Two earlier attempts got this wrong in the same way, and both failed
 * *silently* — the list parsed short and the guard then demanded a path that
 * was plainly already on it:
 *
 *   - matching quotes with a regex: an apostrophe in a comment ("the coverage
 *     guard's import walk") pairs with the next real quote and desynchronises
 *     every pair after it;
 *   - stripping comments *after* bracket-matching: a `]` inside a comment ends
 *     the array early, so everything below it disappears.
 *
 * Tracking state once closes both, and a `]` inside a quoted path too. See
 * migrated.spec.ts, which pins each of those three cases.
 */
function scanArray(src, from) {
  const paths = []
  let depth = 0
  let i = src.indexOf('[', from)
  if (i === -1) throw new Error('MIGRATED array has no opening bracket')

  for (; i < src.length; i++) {
    const c = src[i]
    const next = src[i + 1]

    if (c === '/' && next === '/') {
      i = src.indexOf('\n', i)
      if (i === -1) break
      continue
    }

    if (c === '/' && next === '*') {
      const close = src.indexOf('*' + '/', i + 2)
      if (close === -1) throw new Error('MIGRATED array has an unterminated comment')
      i = close + 1
      continue
    }

    if (c === "'" || c === '"' || c === "`") {
      const close = src.indexOf(c, i + 1)
      if (close === -1) throw new Error('MIGRATED array has an unterminated string')
      if (c === "'") paths.push(src.slice(i + 1, close))
      i = close
      continue
    }

    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return paths
    }
  }

  throw new Error('MIGRATED array is unterminated')
}

export function migratedPaths(lintPath) {
  const src = readFileSync(lintPath, 'utf8')
  const open = src.indexOf('const MIGRATED = [')
  if (open === -1) {
    throw new Error('could not find MIGRATED in check-admin-strings.mjs')
  }

  const paths = scanArray(src, open)
  if (paths.length === 0) throw new Error('MIGRATED parsed as empty')
  return paths
}

/** A path is on the ratchet directly, or under a directory entry. */
export function coveredBy(paths) {
  return (rel) => paths.some((m) => rel === m || rel.startsWith(m + '/'))
}
