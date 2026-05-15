import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createPressRelease,
  deletePressRelease,
  fetchPressReleases,
  updatePressRelease,
} from '@/api/press-releases'
import type { PressReleaseSummary, PressReleasePayload } from '@/types/press-release'
import { useAuth } from './useAuth'

export function usePressReleases() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<PressReleaseSummary[]>({
    queryKey: ['press-releases'],
    queryFn: fetchPressReleases,
  })

  const create = useMutation({
    mutationFn: (payload: PressReleasePayload) => createPressRelease(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['press-releases'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PressReleasePayload }) =>
      updatePressRelease(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['press-releases'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deletePressRelease(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['press-releases'] }),
  })

  return { query, create, update, remove }
}
