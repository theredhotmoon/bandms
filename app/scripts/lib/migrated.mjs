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
 * RigBackline.vue and told you to add a path the ratchet already covered.
 *
 * This is the same reason template-scan.mjs is shared: two copies of a rule
 * drifting apart is the defect, not the duplication.
 */

/**
 * Blank every comment and string literal, keeping offsets.
 *
 * Four attempts at this parse have now failed, every one of them *silently* —
 * the list came back short and the guard then rejected a file while telling you
 * to add a path already on it:
 *
 *   1. matching quotes with a regex: an apostrophe in a comment ("the coverage
 *      guard's import walk") pairs with the next real quote and desynchronises
 *      every pair after it;
 *   2. stripping comments *after* bracket-matching: a `]` in a comment ends the
 *      array early and everything below it disappears;
 *   3. a hand-rolled scanner that consumed double-quoted strings but only
 *      collected single-quoted ones, so one Prettier run with singleQuote off
 *      would drop entries — and that one failed *open*, quietly un-ratcheting
 *      whatever it lost;
 *   4. the same scanner mishandling a backslash escape inside a path.
 *
 * Masking first makes the rest trivial: brackets and the declaration are found
 * in text that provably contains no comment or string, and the paths are then
 * read from the original with one regex that handles both quote styles and
 * escapes — the same `BACKSLASH.` rule template-scan.mjs documents as
 * load-bearing.
 */
/**
 * Known limitation, and the reason it is acceptable: regex literals.
 *
 * This is not a JS lexer. It does not distinguish `/.../` from division, so a
 * regex containing an *odd* number of quotes — `/[^']/` — starts what looks
 * like a string and runs off the end. That **throws**, and both guards exit 1
 * on a throw, so the failure is loud and the list is never silently short.
 * check-admin-strings.mjs contains no such regex today (checked), and the
 * MIGRATED array it owns is a flat list of quoted paths where one could not
 * sensibly appear. Telling regex from division needs full expression context,
 * which is a large amount of machinery to buy a fail-closed case that is
 * already fail-closed.
 */
function maskNonCode(src) {
  // Two masks, deliberately. `masked` blanks comments *and* strings and is
  // what the brackets and the declaration are found in. `noComments` blanks
  // only comments and is what the paths are read from — reading them from the
  // raw source instead put an apostrophe in a comment back in play and quietly
  // picked up quoted words out of the comments inside the array itself.
  const out = src.split('')
  const noCom = src.split('')
  const templates = []
  const blank = (from, to, target) => {
    for (let k = from; k < to && k < target.length; k++) if (target[k] !== '\n') target[k] = ' '
  }
  const blankBoth = (from, to) => { blank(from, to, out); blank(from, to, noCom) }

  for (let i = 0; i < src.length; i++) {
    const c = src[i]

    if (c === '/' && src[i + 1] === '/') {
      let end = src.indexOf('\n', i)
      if (end === -1) end = src.length
      blankBoth(i, end)
      i = end
      continue
    }

    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*' + '/', i + 2)
      if (end === -1) throw new Error('unterminated block comment')
      blankBoth(i, end + 2)
      i = end + 1
      continue
    }

    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      for (; j < src.length; j++) {
        if (src[j] === '\\') { j++; continue }
        if (src[j] === c) break
      }
      if (j >= src.length) throw new Error('unterminated string literal')
      if (c === '`') templates.push([i, j])
      blank(i, j + 1, out)
      i = j
      continue
    }
  }

  return { masked: out.join(''), noComments: noCom.join(''), templates }
}

/** Both quote styles, escapes honoured. A path is a plain string literal. */
const PATH_LITERAL = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g
const UNESCAPE = /\\(.)/g

export function migratedPaths(lintPath) {
  const src = readFileSync(lintPath, 'utf8')
  const { masked, noComments, templates } = maskNonCode(src)

  // Searched in the masked text, so a `const MIGRATED = [` written inside a
  // comment cannot be mistaken for the declaration — which used to send the
  // bracket count off from a bracket that was itself commented out, and report
  // a perfectly well-formed array as unterminated.
  const open = masked.indexOf('const MIGRATED = [')
  if (open === -1) {
    throw new Error('could not find MIGRATED in check-admin-strings.mjs')
  }

  let depth = 0
  let end = -1
  for (let i = masked.indexOf('[', open); i < masked.length; i++) {
    if (masked[i] === '[') depth++
    else if (masked[i] === ']') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) throw new Error('MIGRATED array is unterminated')

  // A template literal is not a static path, and guessing at one is how a
  // silent drop starts. Refuse instead.
  if (templates.some(([a, b]) => a > open && b < end)) {
    throw new Error('MIGRATED contains a template literal; paths must be plain strings')
  }

  // m[2] is the raw literal, so an escape is still escaped. Unescaping keeps
  // the parsed value equal to the string JS would produce.
  const paths = [...noComments.slice(open, end).matchAll(PATH_LITERAL)]
    .map((m) => m[2].replace(UNESCAPE, '$1'))
  if (paths.length === 0) throw new Error('MIGRATED parsed as empty')
  return paths
}

/** A path is on the ratchet directly, or under a directory entry. */
export function coveredBy(paths) {
  return (rel) => paths.some((m) => rel === m || rel.startsWith(m + '/'))
}
