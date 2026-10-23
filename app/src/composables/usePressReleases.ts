import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createPressRelease,
  deletePressRelease,
  fetchPressReleases,
  updatePressRelease,
} from '@/api/press-releases'
import type { PressReleaseSummary, PressReleasePayload } from '@/types/press-release'
import { appendToList } from '@/utils/queryCache'
import { useAuth } from './useAuth'

/** The create mutation on its own (no list observer); appends the row to the list cache. */
export function useCreatePressRelease() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: PressReleasePayload) => createPressRelease(token.value!, payload),
    onSuccess: (press) => appendToList<PressReleaseSummary>(queryClient, ['press-releases'], press),
  })
}

export function usePressReleases() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<PressReleaseSummary[]>({
    queryKey: ['press-releases'],
    queryFn: fetchPressReleases,
  })

  const create = useCreatePressRelease()

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
