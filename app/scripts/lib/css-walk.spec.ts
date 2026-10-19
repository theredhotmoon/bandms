import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { blankStrings, compounds, segments, stripCssComments } from './css-walk.mjs'

const types = (css: string): string[] => [...segments(css)].map((s: { type: string }) => s.type)
const join = (css: string): string => [...segments(css)].map((s: { text: string }) => s.text).join('')

describe('segments', () => {
  it('splits comments, strings, unquoted urls and text, keeping every character', () => {
    const css = '/* c */.a{content:"x";background:url(a.png)}'
    expect(types(css)).toEqual(['comment', 'text', 'string', 'text', 'url', 'text'])
    expect(join(css)).toBe(css)
  })

  it('treats a quoted url() as text plus a string, so a ) inside the quotes is not its end', () => {
    expect(types('url("x)y")')).toEqual(['text', 'string', 'text'])
    expect(types("URL('x)y')")).toEqual(['text', 'string', 'text'])
  })

  it('balances the parentheses of an unquoted url, so a ) inside a data URI is not its end', () => {
    const css = ".a{background:url(data:image/svg+xml,%3Csvg fill='rgb(0,0,0)'%3E)}.b{x:y}"
    const url = [...segments(css)].find((s: { type: string }) => s.type === 'url') as { text: string }
    expect(url.text).toBe("url(data:image/svg+xml,%3Csvg fill='rgb(0,0,0)'%3E)")
    expect(join(css)).toBe(css)
  })

  it('reads URL( in any case', () => {
    expect(types('.a{background:URL(x.png)}')).toEqual(['text', 'url', 'text'])
  })

  it('takes a backslash as the escape it is, so an escaped quote opens no string', () => {
    expect(types(".content-\\[\\'…\\'\\]{x:y}")).toEqual(['text'])
    expect(types('.a{content:"a\\"b"}')).toEqual(['text', 'string', 'text'])
  })

  it('reads a quote with no partner on its line as plain text, so a stray apostrophe swallows nothing', () => {
    const css = ".a{--note:it's} /* #000 */\n.b{color:#fff /* #000 */}"
    expect(types(css)).toEqual(['text', 'comment', 'text', 'comment', 'text'])
    expect(join(css)).toBe(css)
    expect(types("a 'x'\n'y")).toEqual(['text', 'string', 'text'])
  })
})

describe('stripCssComments', () => {
  it('blanks comments and keeps offsets', () => {
    expect(stripCssComments('a/* x */b"/*"c')).toBe('a       b"/*"c')
    expect(stripCssComments('a/* x\ny */b')).toBe('a    \n    b')
  })

  it('does not take the /**/ inside a glob for a comment', () => {
    expect(stripCssComments('@source not "../src/**/*.spec.ts";')).toBe('@source not "../src/**/*.spec.ts";')
  })

  it('still blanks a comment on and after a line with a stray apostrophe', () => {
    expect(stripCssComments(".a{--note:it's} /* #000 */\n.b{color:#fff /* #000 */}")).toBe(".a{--note:it's}           \n.b{color:#fff           }")
  })
})

describe('blankStrings', () => {
  it('blanks strings with their quotes and unquoted url bodies, keeping offsets', () => {
    expect(blankStrings('.a{content:"};{";background:url(a;b{c})}')).toBe('.a{content:     ;background:url(      )}')
    expect(blankStrings(".q[data-x='a;b']{x:y}")).toBe('.q[data-x=     ]{x:y}')
  })

  it('leaves a quoted url to the string rule', () => {
    expect(blankStrings('url("a)b")')).toBe('url(     )')
  })

  it('leaves a quote with no partner on its line alone', () => {
    expect(blankStrings("a 'x\n.b{}")).toBe("a 'x\n.b{}")
  })
})

describe('compounds', () => {
  it('splits a selector list at top-level commas and trims', () => {
    expect(compounds('dialog, .rounded-card ,.x')).toEqual(['dialog', '.rounded-card', '.x'])
  })

  it('does not count an escaped bracket toward nesting', () => {
    expect(compounds(".before\\:content-\\[\\'\\(\\'\\],.flex")).toEqual([".before\\:content-\\[\\'\\(\\'\\]", '.flex'])
    expect(compounds('.\\[x\\],.grid')).toEqual(['.\\[x\\]', '.grid'])
  })

  it('does not split inside :is(), :where() or an attribute value', () => {
    expect(compounds('.a:is(.b,.rounded-card)')).toEqual(['.a:is(.b,.rounded-card)'])
    expect(compounds('.a[data-x="b,c"],.d')).toEqual(['.a[data-x="b,c"]', '.d'])
  })
})
