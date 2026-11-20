import { describe, expect, it } from 'vitest'
import { footClips } from './postClips'
import type { RenderableClip } from '@/types/clip'
import type { PostBlock } from '@/types/post'

const clip = (id: number): RenderableClip =>
  ({ id, provider: 'youtube', url: `https://youtu.be/x${id}`, embed_id: `x${id}`, title: null, category: 'live', recorded_on: null }) as RenderableClip

const ref = (entity: 'clip' | 'concert', id: number | null): PostBlock =>
  ({ id: 100 + (id ?? 0), position: 0, type: 'ref', entity, data: id === null ? null : { id } })

describe('footClips', () => {
  it('lists the linked clips in their order', () => {
    expect(footClips([clip(3), clip(1)], []).map(c => c.id)).toEqual([3, 1])
  })

  it('drops a clip that a reference block already embeds', () => {
    expect(footClips([clip(1), clip(2)], [ref('clip', 2)]).map(c => c.id)).toEqual([1])
  })

  it('ignores other entities with the same id and refs to deleted clips', () => {
    expect(footClips([clip(1), clip(2)], [ref('concert', 1), ref('clip', null)]).map(c => c.id)).toEqual([1, 2])
  })

  it('treats a post from an older API (no clips) as none', () => {
    expect(footClips(undefined, undefined)).toEqual([])
  })
})
