import type { PostBlock } from '@/types/post'
import type { RenderableClip } from '@/types/clip'

/**
 * The clips listed at the foot of an article: those ticked under "Link to…
 * → Videos", minus any a reference block already embeds in the text. A clip
 * placed in the article is shown where the band put it, never a second time
 * at the end.
 */
export function footClips(clips: readonly RenderableClip[] | undefined, blocks: readonly PostBlock[] | undefined): RenderableClip[] {
  const embedded = new Set<number>()
  for (const b of blocks ?? []) {
    if (b.type !== 'ref' || b.entity !== 'clip' || !b.data) continue
    const id = Number(b.data.id)
    if (Number.isFinite(id)) embedded.add(id)
  }
  return (clips ?? []).filter(c => !embedded.has(c.id))
}
