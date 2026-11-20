import { describe, expect, it } from 'vitest'
import { postPreviewUrl, previewNote } from './postPreview'

const TOKEN = 'aB3'.repeat(13) + 'z'

describe('postPreviewUrl', () => {
  it('builds the directory URL under the locale', () => {
    expect(postPreviewUrl('pl', TOKEN)).toBe(`/pl/post-preview/${TOKEN}/`)
  })

  it('gives no link for a missing or malformed token or locale', () => {
    expect(postPreviewUrl('en', undefined)).toBeNull()
    expect(postPreviewUrl('en', '../admin')).toBeNull()
    expect(postPreviewUrl('en', 'short')).toBeNull()
    expect(postPreviewUrl('../x', TOKEN)).toBeNull()
  })
})

describe('previewNote', () => {
  it('asks for a save before anything else', () => {
    expect(previewNote({ dirty: true, building: true, postsPending: true })).toBe('saveFirst')
  })

  it('then reports a running build, then a pending one', () => {
    expect(previewNote({ dirty: false, building: true, postsPending: true })).toBe('building')
    expect(previewNote({ dirty: false, building: false, postsPending: true })).toBe('pending')
  })

  it('says nothing when the preview is current', () => {
    expect(previewNote({ dirty: false, building: false, postsPending: false })).toBeNull()
  })
})
