import { describe, expect, it } from 'vitest'
import { firstBioWithText, hasBioText } from './bio'

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
  })

  it('accepts plain text and HTML with text', () => {
    expect(hasBioText('Formed in 2025.')).toBe(true)
    expect(hasBioText('<p>Formed in <strong>2025</strong>.</p>')).toBe(true)
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
