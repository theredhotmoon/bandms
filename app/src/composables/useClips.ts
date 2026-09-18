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

  const create = useMutation({
    mutationFn: (payload: ClipPayload) => createClip(token.value!, payload),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ClipPayload }) => updateClip(token.value!, id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteClip(token.value!, id),
    onSuccess: invalidate,
  })
  const attach = useMutation({
    mutationFn: ({ id, owner }: { id: number; owner: ClipAttach }) => attachClip(token.value!, id, owner),
    onSuccess: invalidate,
  })
  const detach = useMutation({
    mutationFn: ({ id, owner }: { id: number; owner: ClipAttach }) => detachClip(token.value!, id, owner),
    onSuccess: invalidate,
  })

  return { query, create, update, remove, attach, detach }
}
