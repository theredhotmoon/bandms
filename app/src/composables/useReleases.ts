import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createRelease, deleteRelease, fetchReleases, updateRelease } from '@/api/releases'
import type { ReleasePayload } from '@/types/release'
import { useAuth } from './useAuth'

export function useReleases() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['releases'],
    queryFn: fetchReleases,
  })

  const create = useMutation({
    mutationFn: (payload: ReleasePayload) => createRelease(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['releases'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReleasePayload }) =>
      updateRelease(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['releases'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteRelease(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['releases'] }),
  })

  return { query, create, update, remove }
}
