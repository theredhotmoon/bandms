/**
 * The one walk over JavaScript / TypeScript text that the guards reading
 * <script> blocks and .ts modules go through — the script-side twin of
 * css-walk.mjs, and for the same reason: a regex comment stripper takes the
 * `/*` inside a string for a comment and blanks every definition up to the
 * next `*\/`, and a lookbehind for "inside a string" cannot see past the
 * start of the line a template literal continues on.
 *
 *   - scriptSegments():      the walk, as typed pieces;
 *   - blankScriptComments(): comments blanked, offsets kept;
 *   - scriptStrings():       the inside of every string literal, with its
 *                            offset — template literals included, newlines
 *                            and all.
 *
 * Not a parser. A regular-expression literal is told from division by what
 * precedes the `/`: an operator, an opening bracket, a keyword-ish word end
 * (`return`, `=>`) or nothing — the usual heuristic, which is right for the
 * code the guards read and keeps a `/['"]/` from opening a string.
 */
import { blank } from './css-walk.mjs'

/** What may precede a `/` that starts a regex literal rather than a division: an operator, an opening bracket, a separator, or nothing. */
const REGEX_LEAD = /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|=>)\s*$/

/** Yields { type, text } pieces of `js`: 'comment', 'string' (quotes included; a template literal spans lines), 'regex' or 'text'. */
export function* scriptSegments(js) {
  const n = js.length
  let text = ''
  const flush = function* () {
    if (text) yield { type: 'text', text }
    text = ''
  }
  for (let i = 0; i < n; ) {
    const c = js[i]
    if (c === '/' && js[i + 1] !== '*' && js[i + 1] !== '/' && REGEX_LEAD.test(text)) {
      // A regex literal: to the closing `/` outside a character class, flags included.
      let j = i + 1
      let inClass = false
      for (; j < n && js[j] !== '\n'; j++) {
        if (js[j] === '\\') j++
        else if (js[j] === '[') inClass = true
        else if (js[j] === ']') inClass = false
        else if (js[j] === '/' && !inClass) break
      }
      if (js[j] === '/') {
        while (j + 1 < n && /[a-z]/i.test(js[j + 1])) j++
        yield* flush()
        yield { type: 'regex', text: js.slice(i, j + 1) }
        i = j + 1
        continue
      }
    }
    if (c === '/' && js[i + 1] === '*') {
      yield* flush()
      const e = js.indexOf('*/', i + 2)
      const j = e < 0 ? n : e + 2
      yield { type: 'comment', text: js.slice(i, j) }
      i = j
      continue
    }
    if (c === '/' && js[i + 1] === '/') {
      yield* flush()
      const e = js.indexOf('\n', i)
      const j = e < 0 ? n : e
      yield { type: 'comment', text: js.slice(i, j) }
      i = j
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      // A quoted string ends at its quote or, unterminated, at the line's end; a template literal runs on.
      while (j < n && js[j] !== c && (c === '`' || js[j] !== '\n')) j += js[j] === '\\' ? 2 : 1
      if (js[j] === c) {
        yield* flush()
        yield { type: 'string', text: js.slice(i, j + 1) }
        i = j + 1
        continue
      }
      text += c
      i++
      continue
    }
    text += c
    i++
  }
  yield* flush()
}

/** Script with its comments blanked, offsets kept. */
export function blankScriptComments(js) {
  let out = ''
  for (const s of scriptSegments(js)) out += s.type === 'comment' ? blank(s.text) : s.text
  return out
}

/** The inside of every string literal, as [{ text, index }] with `index` the offset of `text` in `js`. */
export function scriptStrings(js) {
  const out = []
  let at = 0
  for (const s of scriptSegments(js)) {
    if (s.type === 'string') out.push({ text: s.text.slice(1, -1), index: at + 1 })
    at += s.text.length
  }
  return out
}
