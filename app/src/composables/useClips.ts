import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { attachClip, createClip, deleteClip, detachClip, fetchClips, updateClip } from '@/api/clips'
import type { Clip, ClipAttach, ClipPayload } from '@/types/clip'
import { useAuth } from './useAuth'

export const CLIPS_QKEY = ['clips'] as const

export function useClips() {
  const { token } = useAuth()
  const qc = useQueryClient()

  const query = useQuery<Clip[]>({ queryKey: CLIPS_QKEY, queryFn: fetchClips })

  // A clip change also changes every owner that carries it — the concert
  // editor reads clips off the concert response, so invalidate those too.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: CLIPS_QKEY })
    qc.invalidateQueries({ queryKey: ['concerts'] })
  }

  // Every mutation returns the full clip, so the library cache is written from
  // the response before the refetch lands. Consumers that render a list from
  // this query — the post editor's clip select, the concert form's attached
  // list — see the change at once; otherwise a block pointed at a just-created
  // clip shows the placeholder until the refetch, because its <option> does
  // not exist yet.
  const upsert = (clip: Clip) => {
    qc.setQueryData<Clip[]>(CLIPS_QKEY, old =>
      old?.some(c => c.id === clip.id) ? old.map(c => (c.id === clip.id ? clip : c)) : [...(old ?? []), clip],
    )
    invalidate()
  }

  const create = useMutation({
    mutationFn: (payload: ClipPayload) => createClip(token.value!, payload),
    onSuccess: upsert,
  })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ClipPayload }) => updateClip(token.value!, id, payload),
    onSuccess: upsert,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteClip(token.value!, id),
    onSuccess: (_, id) => {
      qc.setQueryData<Clip[]>(CLIPS_QKEY, old => old?.filter(c => c.id !== id))
      invalidate()
    },
  })
  const attach = useMutation({
    mutationFn: ({ id, owner }: { id: number; owner: ClipAttach }) => attachClip(token.value!, id, owner),
    onSuccess: upsert,
  })
  const detach = useMutation({
    mutationFn: ({ id, owner }: { id: number; owner: ClipAttach }) => detachClip(token.value!, id, owner),
    onSuccess: upsert,
  })

  return { query, create, update, remove, attach, detach }
}
