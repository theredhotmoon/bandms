import { describe, expect, it } from 'vitest'
import { normaliseLinkHref, toEditorHtml } from './richText'

describe('toEditorHtml', () => {
  it('passes editor HTML through', () => {
    expect(toEditorHtml('<p>a <em>b</em></p>')).toBe('<p>a <em>b</em></p>')
  })

  it('keeps plain-text line breaks as paragraphs and <br>', () => {
    expect(toEditorHtml('one\ntwo\n\nthree')).toBe('<p>one<br>two</p><p>three</p>')
  })

  it('escapes plain text', () => {
    expect(toEditorHtml('a < b')).toBe('<p>a &lt; b</p>')
  })

  it('is empty for nothing', () => {
    expect(toEditorHtml(null)).toBe('')
    expect(toEditorHtml('  \n ')).toBe('')
  })
})

describe('normaliseLinkHref', () => {
  it('adds https to a bare domain', () => {
    expect(normaliseLinkHref(' band.pl/tour ')).toBe('https://band.pl/tour')
  })

  it('keeps schemes and in-site paths as typed', () => {
    expect(normaliseLinkHref('mailto:x@y.z')).toBe('mailto:x@y.z')
    expect(normaliseLinkHref('http://a.b')).toBe('http://a.b')
    expect(normaliseLinkHref('/en/concerts')).toBe('/en/concerts')
  })

  it('is blank for blank input, which removes the link', () => {
    expect(normaliseLinkHref('   ')).toBe('')
  })
})
