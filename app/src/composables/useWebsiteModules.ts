import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchModules, updateModule, updateSiteSettings, triggerRebuild, fetchRebuildStatus } from '@/api/website-modules'
import { useAuth } from './useAuth'

export function useWebsiteModules() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['website-modules'],
    queryFn: () => fetchModules(token.value!),
    enabled: () => token.value !== null,
  })

  const rebuildStatusQuery = useQuery({
    queryKey: ['rebuild-status'],
    queryFn: () => fetchRebuildStatus(token.value!),
    enabled: () => token.value !== null,
    refetchInterval: (query) => query.state.data?.status === 'building' ? 2000 : false,
    staleTime: 0,
  })

  const toggleModule = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      updateModule(token.value!, slug, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const setAutoRebuild = useMutation({
    mutationFn: (autoRebuild: boolean) => updateSiteSettings(token.value!, autoRebuild),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const rebuild = useMutation({
    mutationFn: () => triggerRebuild(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rebuild-status'] }),
  })

  return { query, rebuildStatusQuery, toggleModule, setAutoRebuild, rebuild }
}
