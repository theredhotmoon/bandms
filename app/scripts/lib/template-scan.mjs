/**
 * The template scanner, shared by check-admin-strings.mjs and
 * check-i18n-coverage.mjs.
 *
 * It lived inside the string lint until the coverage guard needed the same
 * "does this file show a reader any English?" question. A second copy would
 * have drifted, and the two guards disagreeing about what counts as copy is
 * precisely the kind of gap this sweep keeps finding.
 */
export const HAS_WORDS = /[A-Za-zÀ-ž]{2,}/
export const HAS_INNER_SPACE = /\S\s+\S/
/** A dotted path like shows.venues.title — a key, not copy. */
export const KEYPATH = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)+$/

/**
 * Does this string literal look like something a person reads?
 *
 * Copy either starts with a capital ("Save", "New tour") or contains a space
 * ("✓ Mark as Scanned"). The technical literals sharing these lines —
 * 'main', 'pending', 'T', class names, key paths — do neither. 'PLN' and
 * friends are the residue; mark those i18n-ignore.
 */
/** Two letters ANYWHERE, not two consecutive — "e.g. 500" has no adjacent pair. */
export const hasTwoLetters = (v) => !!v && !KEYPATH.test(v) && (v.match(/[A-Za-zÀ-ž]/g) ?? []).length >= 2

export function looksLikeCopy(v) {
  if (!hasTwoLetters(v)) return false
  return /^[^a-zà-ž]*[A-ZÀ-Ž]/.test(v) || HAS_INNER_SPACE.test(v)
}

/** Attributes whose value is copy. Bound forms (:title="…") are checked too. */
export const COPY_ATTRS = 'placeholder|aria-label|title|label|message|alt'
// Built from a regex literal, NOT a template literal: in a template literal
// `\w` collapses to the literal character `w`, so the lookbehind compiled to
// (?<![:w-]) and excluded only the letter w — meaning `:subtitle="…"` was
// scanned as if it were a static `title="…"`.
export const STATIC_ATTR = new RegExp('(?<![:\\w-])(?:' + COPY_ATTRS + ')="([^"]*)"', 'g')
export const BOUND_ATTR = new RegExp(`:(?:${COPY_ATTRS})="([^"]*)"`, 'g')
// Escaped quotes ARE handled. Without it, `toast.error('Couldn\'t save', 'Failed
// to publish')` consumes `'Couldn\'` as the first literal, re-anchors mid-line,
// and the second string is never produced — so one apostrophe silently stops a
// whole line being checked. That is hiding a hit, not truncating one.
export const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g

/** Any other directive expression: @click="…", :data-tip="…", v-bind:x="…". */
export const OTHER_DIRECTIVE = /(?:@|v-on:|v-bind:|:)([A-Za-z0-9_.-]+)="([^"]*)"/g

/**
 * Every string literal inside an expression, filtered to copy.
 *
 * `${…}` is stripped first: the interpolated expression is code, never copy.
 * Without that, `:style="\`width:${pct}%\`"` reads as copy because the
 * identifier supplies the letters. Real copy survives it — `\`v${n} deleted\``
 * becomes "v deleted", which still has a space and letters.
 */
export function copyLiterals(expr) {
  LITERAL.lastIndex = 0
  return [...expr.matchAll(LITERAL)]
    .map(m => (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ''))
    .filter(looksLikeCopy)
}

export function templateOf(src) {
  const start = src.indexOf('<template>')
  const end = src.lastIndexOf('</template>')
  return start === -1 || end === -1 ? null : { body: src.slice(start, end), offset: src.slice(0, start).split('\n').length }
}

/**
 * Text runs that sit between tags, with their 1-based line within `tpl`.
 *
 * Scans character by character so a run spanning several lines is seen, which
 * a per-line regex cannot do.
 *
 * This tracks an explicit in-tag flag plus the attribute quote, rather than a
 * `<`/`>` nesting depth. The depth version counted EVERY angle bracket, so a
 * comparison inside a binding — `:class="{ 'x--past': lvl.level < currentLevel }"`
 * in CareerLevelWidget.vue — incremented depth with no `>` to balance it, and
 * the file stayed "inside a tag" to the end: **zero** text runs scanned, a
 * green tick over nine hardcoded English strings. The `>` half is the same bug
 * mirrored (`shortChars > 240` closes a tag early), which is how a lint can
 * both miss text and invent it.
 *
 * So: `<` opens a tag only when followed by a name, `/` or `!`, and `>` closes
 * one only outside an attribute value.
 */
export function textRuns(tpl) {
  const runs = []
  let i = 0, line = 1, buf = '', bufLine = 1
  let inTag = false, quote = null

  const flush = () => {
    if (HAS_WORDS.test(buf)) runs.push({ text: buf.trim().replace(/\s+/g, ' '), line: bufLine })
    buf = ''
  }

  while (i < tpl.length) {
    if (!inTag && tpl.startsWith('<!--', i)) {
      const end = tpl.indexOf('-->', i)
      const skipped = tpl.slice(i, end === -1 ? tpl.length : end + 3)
      line += (skipped.match(/\n/g) || []).length
      i += skipped.length
      continue
    }
    if (!inTag && tpl.startsWith('{{', i)) {
      const end = tpl.indexOf('}}', i)
      const skipped = tpl.slice(i, end === -1 ? tpl.length : end + 2)
      line += (skipped.match(/\n/g) || []).length
      i += skipped.length
      continue
    }
    const ch = tpl[i]

    if (inTag) {
      if (quote) { if (ch === quote) quote = null }
      else if (ch === '"' || ch === "'") quote = ch
      else if (ch === '>') { inTag = false; buf = ''; bufLine = line }
    } else if (ch === '<' && /[A-Za-z/!]/.test(tpl[i + 1] ?? '')) {
      flush()
      inTag = true
    } else {
      if (!buf.trim() && ch.trim()) bufLine = line
      buf += ch
    }

    if (ch === '\n') line++
    i++
  }
  flush()
  return runs
}
