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
    // The new row goes into the list at once (a reference block or picker may
    // select it before the refetch lands); the refetch is not awaited, since
    // `mutateAsync` resolves after `onSuccess`.
    onSuccess: (release) => {
      queryClient.setQueryData<ReleaseSummary[]>(qk.value, (old) => [...(old ?? []), release])
      void queryClient.invalidateQueries({ queryKey: ['releases'] })
    },
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
