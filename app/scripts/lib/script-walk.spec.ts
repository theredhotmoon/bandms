import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { blankScriptComments, scriptSegments, scriptStrings } from './script-walk.mjs'

const types = (js: string): string[] => [...scriptSegments(js)].map((s: { type: string }) => s.type)
const join = (js: string): string => [...scriptSegments(js)].map((s: { text: string }) => s.text).join('')

describe('scriptSegments', () => {
  it('splits block comments, line comments, strings and text, keeping every character', () => {
    const js = "/* a */ const x = 'y' // z\nconst t = `q`"
    expect(types(js)).toEqual(['comment', 'text', 'string', 'text', 'comment', 'text', 'string'])
    expect(join(js)).toBe(js)
  })

  it('does not take a comment marker inside a string for a comment', () => {
    expect(types("const g = 'src/*'\nconst e = '*/'\nconst u = 'https://x.test'")).toEqual(['text', 'string', 'text', 'string', 'text', 'string'])
  })

  it('lets a template literal span lines and ends an unterminated quote at its line', () => {
    expect(types('const t = `a\n  b`\nconst s = 1')).toEqual(['text', 'string', 'text'])
    expect(types("const s = it's\n// c")).toEqual(['text', 'comment'])
  })

  it('reads a regex literal as a regex, so a quote inside it opens no string', () => {
    expect(types("const q = /['\"]/g; const s = 'x'")).toEqual(['text', 'regex', 'text', 'string'])
    expect(types("const re = /it's/\nconst c = '[--radius-card:0]'")).toEqual(['text', 'regex', 'text', 'string'])
    expect(types('x.replace(/a\\/b[/]c/i, "d")')).toEqual(['text', 'regex', 'text', 'string', 'text'])
  })

  it('reads a division as text', () => {
    expect(types("const half = total / 2 / count\nconst s = 'x'")).toEqual(['text', 'string'])
  })

  it('honours escapes inside strings', () => {
    expect(types("const s = 'a\\'b' // c")).toEqual(['text', 'string', 'text', 'comment'])
  })
})

describe('blankScriptComments', () => {
  it('blanks comments and keeps offsets', () => {
    expect(blankScriptComments("a /* b */ c // d\ne")).toBe('a         c     \ne')
  })

  it('leaves comment markers inside strings alone', () => {
    const js = "const g = 'src/*'\nel.style.setProperty('--radius-card', '0')\nconst e = '*/'"
    expect(blankScriptComments(js)).toBe(js)
  })
})

describe('scriptStrings', () => {
  it('returns the inside of each string with its offset, template literals whole', () => {
    expect(scriptStrings("const a = 'x'\nconst t = `p-4\n  [--radius-card:4px]`")).toEqual([
      { text: 'x', index: 11 },
      { text: 'p-4\n  [--radius-card:4px]', index: 25 },
    ])
  })

  it('skips strings inside comments', () => {
    expect(scriptStrings("// 'not'\n/* \"nor\" */\nconst s = 'yes'")).toEqual([{ text: 'yes', index: 32 }])
  })
})
