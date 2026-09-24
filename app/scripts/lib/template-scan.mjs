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

export const NL = String.fromCharCode(10)

/** 1-based line count of a prefix. */
export const countLines = (prefix) => prefix.split(NL).length

/** Literals inside {{ … }} — where "Save" and every ternary label hides. */
export function mustacheHits(tpl, offset) {
  const out = []
  const re = /\{\{([\s\S]*?)\}\}/g
  let m
  while ((m = re.exec(tpl)) !== null) {
    const line = offset + countLines(tpl.slice(0, m.index)) - 1
    const hits = copyLiterals(m[1])
    if (hits.length) out.push({ line, hits })
    else if (bareKeypath(m[1])) out.push({ line, hits: [`${m[1].trim()} — looks like a translation key with no $t()`] })
  }
  return out
}

/**
 * A mustache whose whole body is a quoted dotted key and nothing else.
 *
 * `{{ ('band.setups.title') }}` renders the key itself on screen, and every
 * guard passes it: `looksLikeCopy` deliberately rejects a dotted path (it is a
 * key, not prose), `check-i18n-keys` only resolves literal `$t('…')`
 * references, and `vue-tsc` sees a valid string expression.
 *
 * It shipped exactly once, in the PR that added this check — four of them in
 * one file, because a shell-escaped `$t` collapsed to nothing in a migration
 * script and the output looked plausible. A person reviewing the diff sees
 * mustaches full of catalogue keys either way.
 */
function bareKeypath(expr) {
  const s = expr.trim().replace(/^\(+|\)+$/g, '').trim()
  const lit = s.match(/^'([^']+)'$|^"([^"]+)"$|^`([^`]+)`$/)
  return !!lit && KEYPATH.test(lit[1] ?? lit[2] ?? lit[3])
}

/**
 * Every user-facing string in a file, as { line, hits }.
 *
 * THE single definition of "copy" for both guards. It used to live inside the
 * string lint, and the coverage guard reimplemented a fraction of it —
 * textRuns only, 1 of the 4 sources — so a child whose English lived entirely
 * in `placeholder` / `aria-label` / `title` attributes passed the coverage
 * check silently. SingleImageUpload, one of the components that gap let ship,
 * is exactly that shape.
 *
 * Exemptions are NOT applied here. The caller decides: the string lint honours
 * `i18n-ignore`, while the coverage guard deliberately does not — an
 * unmigrated file's ignore markers are not yet meaningful, and the intended
 * fix for a report is to put the file on the ratchet first.
 */
export function copyHits(src, { isTs = false } = {}) {
  const out = []
  const lines = src.split(NL)

  const tpl = templateOf(src)
  if (tpl) {
    for (const run of textRuns(tpl.body)) out.push({ line: tpl.offset + run.line - 1, hits: [run.text] })
    for (const m of mustacheHits(tpl.body, tpl.offset)) out.push(m)

    tpl.body.split(NL).forEach((l, i) => {
      const line = tpl.offset + i
      // A STATIC copy attribute's whole value is user-facing by definition, so
      // the capital-or-space heuristic must NOT apply here — it would let
      // placeholder="unlimited" through. Any two letters is enough.
      STATIC_ATTR.lastIndex = 0
      const stat = [...l.matchAll(STATIC_ATTR)].map((m) => m[1]).filter(hasTwoLetters)
      BOUND_ATTR.lastIndex = 0
      const bound = [...l.matchAll(BOUND_ATTR)].flatMap((m) => copyLiterals(m[1]))
      // Literals in any other directive expression — @click="err = 'Try again'".
      OTHER_DIRECTIVE.lastIndex = 0
      const other = [...l.matchAll(OTHER_DIRECTIVE)].flatMap((m) => copyLiterals(m[2]))
      const hits = [...stat, ...bound, ...other]
      if (hits.length) out.push({ line, hits })
    })
  }

  // Script side: any copy literal, not just toasts. A modal title built in a
  // computed is exactly as user-facing as one in the template.
  const sStart = src.indexOf('<script')
  const sEnd = src.lastIndexOf('</script>')
  const range = isTs
    ? [0, lines.length]
    : sStart === -1
      ? null
      : [countLines(src.slice(0, sStart)) - 1, countLines(src.slice(0, sEnd))]
  if (range) {
    for (let i = range[0]; i < range[1]; i++) {
      const l = lines[i]
      if (!l) continue
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue
      // Anchored: an unanchored `from ['"]` skipped any line merely containing
      // `from '`, including toast bodies and trailing comments.
      if (/^\s*(?:import\b|export\s+(?:\*|\{|type\b))/.test(l)) continue
      const hits = copyLiterals(l)
      if (hits.length) out.push({ line: i + 1, hits })
    }
  }

  return out
}
