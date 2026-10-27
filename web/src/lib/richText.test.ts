import { describe, expect, it } from 'vitest'
import { looksLikeHtml, plainTextHtml, richTextHtml } from './richText'

describe('richTextHtml', () => {
  it('passes editor HTML through untouched', () => {
    const html = '<p>One <strong>bold</strong></p><ul><li>a</li></ul>'
    expect(richTextHtml(html)).toBe(html)
  })

  it('turns blank lines into paragraphs and single newlines into breaks', () => {
    expect(richTextHtml('First line\nsecond line\n\nNew paragraph'))
      .toBe('<p>First line<br>second line</p><p>New paragraph</p>')
  })

  it('escapes plain text, so a stray < is printed rather than parsed', () => {
    expect(plainTextHtml('a < b & "c"')).toBe('<p>a &lt; b &amp; &quot;c&quot;</p>')
  })

  it('normalises CRLF and drops empty paragraphs', () => {
    expect(plainTextHtml('a\r\n\r\n\r\n\r\nb\r\n')).toBe('<p>a</p><p>b</p>')
  })

  it('returns an empty string for nothing', () => {
    expect(richTextHtml(null)).toBe('')
    expect(richTextHtml('   ')).toBe('')
  })

  it('does not mistake a comparison for markup', () => {
    expect(looksLikeHtml('3 < 4 and 5 > 2')).toBe(false)
    expect(looksLikeHtml('<p>x</p>')).toBe(true)
    expect(looksLikeHtml('line<br>break')).toBe(true)
  })
})

describe('richTextHtml — a cleared editor', () => {
  it('treats an empty RichEditor document as no text', () => {
    expect(richTextHtml('<p></p>')).toBe('')
    expect(richTextHtml('<p>&nbsp;</p>')).toBe('')
  })
})
