import { describe, expect, it } from 'vitest'
import { previewableDrafts, previewPath } from './postPreview'
import type { Post } from '@/types/post'

const post = (over: Partial<Post>): Post =>
  ({ id: 1, title: 't', published_at: null, preview_token: 'a'.repeat(40), ...over }) as Post

describe('previewableDrafts', () => {
  it('keeps a draft with a well-formed token', () => {
    expect(previewableDrafts([post({})])).toHaveLength(1)
  })

  it('drops a published post — it has its own page', () => {
    expect(previewableDrafts([post({ published_at: '2026-11-20T10:00:00Z' })])).toEqual([])
  })

  it('drops a missing or malformed token, which would become a path segment', () => {
    expect(previewableDrafts([
      post({ preview_token: undefined }),
      post({ preview_token: '../../etc' }),
      post({ preview_token: 'short' }),
    ])).toEqual([])
  })
})

describe('previewPath', () => {
  it('is a directory URL under the locale', () => {
    expect(previewPath('pl', 'abc')).toBe('/pl/post-preview/abc/')
  })
})
