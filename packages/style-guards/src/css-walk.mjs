/**
 * The one walk over CSS text that every style guard reads through — the
 * colour, radius and source guards used to carry their own string and
 * comment rules, and they disagreed (a regex comment stripper took the
 * `/**\/` inside a glob for a comment; a string opened by a stray apostrophe
 * ran to the end of the file in one grammar and to the end of the line in
 * another). One grammar here, three consumers:
 *
 *   - segments():         the walk itself, as typed pieces;
 *   - stripCssComments(): comments blanked, offsets kept;
 *   - blankStrings():     strings and unquoted url() bodies blanked, so a
 *                         brace or semicolon inside one is inert;
 *   - compounds():        a selector list split at its top-level commas.
 *
 * Blanking replaces characters with spaces and keeps newlines, so every
 * offset — and therefore every reported line number — stays true.
 */

/** Replace every character but newlines with a space, so offsets and line numbers hold. */
export const blank = (s) => s.replace(/[^\n]/g, ' ')

/**
 * Yields { type, text } pieces of `css`, in order, concatenating back to the
 * input: 'comment', 'string' (quotes included), 'url' (an unquoted url(…)
 * token, parentheses balanced, so `url(data:…rgb(0,0,0)…)` is one piece) or
 * 'text'. The rules that matter:
 *   - a backslash escapes the next character anywhere, so the `\'` in an
 *     escaped selector such as `.content-\[\'…\'\]` is not a string opening;
 *   - a string ends at its quote on the same line — CSS calls an unescaped
 *     newline in a string a parse error — and a quote with no partner on
 *     its line is plain text, so a stray apostrophe (`it's`) swallows
 *     nothing, not even a comment later on that line;
 *   - a quoted url("…") is text `url(` followed by a string, and `URL(` is
 *     url( too.
 */
export function* segments(css) {
  const n = css.length
  let text = ''
  const flush = function* () {
    if (text) yield { type: 'text', text }
    text = ''
  }
  for (let i = 0; i < n; ) {
    const c = css[i]
    if (c === '\\') {
      text += css.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '/' && css[i + 1] === '*') {
      yield* flush()
      const e = css.indexOf('*/', i + 2)
      const j = e < 0 ? n : e + 2
      yield { type: 'comment', text: css.slice(i, j) }
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && css[j] !== c && css[j] !== '\n') j += css[j] === '\\' ? 2 : 1
      if (css[j] === c) {
        yield* flush()
        yield { type: 'string', text: css.slice(i, j + 1) }
        i = j + 1
        continue
      }
      // No closing quote on the line: a stray apostrophe (`it's`), which is
      // plain text — so a comment or a brace later on that line still counts.
      text += c
      i++
      continue
    }
    if ((c === 'u' || c === 'U') && css.slice(i, i + 4).toLowerCase() === 'url(' && !/["'\s]/.test(css[i + 4] ?? '')) {
      yield* flush()
      let depth = 1
      let j = i + 4
      for (; j < n && depth > 0; j++) {
        if (css[j] === '\\') j++
        else if (css[j] === '(') depth++
        else if (css[j] === ')') depth--
      }
      yield { type: 'url', text: css.slice(i, j) }
      i = j
      continue
    }
    text += c
    i++
  }
  yield* flush()
}

/** CSS with its comments blanked, everything else — strings, urls, escapes — kept whole. */
export function stripCssComments(css) {
  let out = ''
  for (const s of segments(css)) out += s.type === 'comment' ? blank(s.text) : s.text
  return out
}

/** Quoted strings (quotes included) and unquoted url() bodies blanked, so their braces and semicolons are inert. */
export function blankStrings(css) {
  let out = ''
  for (const s of segments(css)) {
    if (s.type === 'string') out += blank(s.text)
    else if (s.type === 'url') out += s.text.slice(0, 4) + blank(s.text.slice(4, -1)) + (s.text.at(-1) === ')' ? ')' : '')
    else out += s.text
  }
  return out
}

/**
 * The compounds of a selector list, split at top-level commas only — a comma
 * inside `:is(…)`, `:where(…)` or an attribute string stays put — and trimmed.
 */
export function compounds(selector) {
  const out = []
  let depth = 0
  let buf = ''
  for (const s of segments(selector)) {
    if (s.type !== 'text') {
      buf += s.text
      continue
    }
    const t = s.text
    for (let i = 0; i < t.length; i++) {
      const c = t[i]
      // An escaped bracket — Tailwind's `content-\[\'\(\'\]` — is a character, not nesting.
      if (c === '\\') {
        buf += t.slice(i, i + 2)
        i++
        continue
      }
      if (c === '(' || c === '[') depth++
      else if (c === ')' || c === ']') depth--
      if (c === ',' && depth === 0) {
        out.push(buf.trim())
        buf = ''
      } else {
        buf += c
      }
    }
  }
  out.push(buf.trim())
  return out
}
