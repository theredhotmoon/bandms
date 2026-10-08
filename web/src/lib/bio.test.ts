import { describe, expect, it } from 'vitest'
import { bioParagraphs, firstBioWithText, hasBioText, stripHtmlText } from './bio'

describe('hasBioText', () => {
  it('treats null, empty and whitespace as blank', () => {
    expect(hasBioText(null)).toBe(false)
    expect(hasBioText(undefined)).toBe(false)
    expect(hasBioText('')).toBe(false)
    expect(hasBioText('   \n ')).toBe(false)
  })

  // RichEditor saves `<p></p>` for an editor that was opened and left empty.
  it('treats tag-only HTML as blank', () => {
    expect(hasBioText('<p></p>')).toBe(false)
    expect(hasBioText('<p></p><p><br></p>')).toBe(false)
    expect(hasBioText('<p>&nbsp;</p>')).toBe(false)
    expect(hasBioText('<p>&#160;</p><p>&#xa0;</p>')).toBe(false) // token-lint-ignore: HTML entities, not colours
    expect(hasBioText('<!-- note --><p></p>')).toBe(false)
  })

  it('accepts plain text and HTML with text', () => {
    expect(hasBioText('Formed in 2025.')).toBe(true)
    expect(hasBioText('<p>Formed in <strong>2025</strong>.</p>')).toBe(true)
  })
})

describe('stripHtmlText', () => {
  it('returns the visible text with entities and tags gone', () => {
    expect(stripHtmlText('<p>&nbsp;Formed in <strong>2025</strong>.</p>')).toBe('Formed in 2025 .')
  })
})

describe('bioParagraphs', () => {
  it('turns RichEditor HTML into text paragraphs without any markup', () => {
    expect(bioParagraphs('<p>Plays <strong>bass</strong>.</p><p>Since 2020.</p>')).toEqual(['Plays bass .', 'Since 2020.'])
  })

  it('never lets markup through — a member-written bio is not trusted HTML', () => {
    expect(bioParagraphs('<p>Hi<script>alert(1)</script></p><img src=x onerror=alert(1)>')).toEqual(['Hi alert(1)'])
  })

  it('splits plain text on blank lines and drops empty paragraphs', () => {
    expect(bioParagraphs('One\n\nTwo\n')).toEqual(['One', 'Two'])
    expect(bioParagraphs('<p></p>')).toEqual([])
    expect(bioParagraphs(null)).toEqual([])
  })
})

describe('firstBioWithText', () => {
  it('skips blank HTML and lands on the next length with text', () => {
    expect(firstBioWithText(['<p></p>', null, 'Short bio', '<p>Full</p>'])).toBe('Short bio')
  })

  it('returns null when every candidate is blank', () => {
    expect(firstBioWithText(['<p></p>', '', null])).toBeNull()
  })
})
