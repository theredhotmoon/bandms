import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createRelease, deleteRelease, fetchReleases, updateRelease } from '@/api/releases'
import type { ReleaseSummary, ReleasePayload } from '@/types/release'
import { useAuth } from './useAuth'
import { useLang } from './useLang'

export function useReleases() {
  const { token } = useAuth()
  const { lang } = useLang()
  const queryClient = useQueryClient()

  const qk = computed(() => ['releases', lang.value])

  const query = useQuery<ReleaseSummary[]>({
    queryKey: qk,
    queryFn: () => fetchReleases(lang.value),
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
