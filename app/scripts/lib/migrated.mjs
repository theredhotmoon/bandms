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
export function migratedPaths(lintPath) {
  const src = readFileSync(lintPath, 'utf8')
  const open = src.indexOf('const MIGRATED = [')
  if (open === -1) {
    throw new Error('could not find MIGRATED in check-admin-strings.mjs')
  }

  // Bracket-matched rather than line-anchored: a regex scanning the whole file
  // would absorb any other quoted-path array added to it and silently exempt
  // those files.
  let depth = 0
  let end = -1
  for (let i = src.indexOf('[', open); i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) throw new Error('MIGRATED array is unterminated')

  // Comments are stripped before the quotes are paired, and that is not
  // cosmetic. An apostrophe inside a comment in the array - "the coverage
  // guard's import walk" - pairs with the next real quote and desynchronises
  // every pair after it, so paths below the comment vanish silently. Hit while
  // adding exactly such a comment: the list parsed short with the two newest
  // entries missing, and the guard then demanded a path that was plainly there.
  const body = src
    .slice(open, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')

  const paths = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1])
  if (paths.length === 0) throw new Error('MIGRATED parsed as empty')
  return paths
}

/** A path is on the ratchet directly, or under a directory entry. */
export function coveredBy(paths) {
  return (rel) => paths.some((m) => rel === m || rel.startsWith(m + '/'))
}
