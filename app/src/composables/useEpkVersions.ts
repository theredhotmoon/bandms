import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchEpkVersions, createEpkVersion, publishEpkVersion, discardEpkVersion } from '@/api/epkVersions'
import type { EpkVersion } from '@/types/epkVersion'
import { useAuth } from './useAuth'

export function useEpkVersions() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<EpkVersion[]>({
    queryKey: ['epk-versions'],
    queryFn:  () => fetchEpkVersions(token.value!),
    enabled:  () => !!token.value,
  })

  const create = useMutation({
    mutationFn: (payload: { release_reason?: string | null }) =>
      createEpkVersion(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['epk-versions'] }),
  })

  const publish = useMutation({
    mutationFn: (id: number) => publishEpkVersion(token.value!, id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['epk-versions'] }),
  })

  const discard = useMutation({
    mutationFn: (id: number) => discardEpkVersion(token.value!, id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['epk-versions'] }),
  })

  return { query, create, publish, discard }
}
