import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchRebuildStatus, triggerRebuild, updateSiteSettings } from '@/api/site-rebuild'
import { useAuth } from './useAuth'

const REBUILD_QUERY_KEY = ['rebuild-status']

export function useSiteRebuild() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: REBUILD_QUERY_KEY,
    queryFn: () => fetchRebuildStatus(token.value!),
    enabled: () => token.value !== null,
    refetchInterval: (query) => (query.state.data?.status === 'building' ? 2000 : 30000),
    staleTime: 0,
  })

  const isBuilding = computed(() => statusQuery.data.value?.status === 'building')
  const autoRebuild = computed(() => statusQuery.data.value?.autoRebuild ?? false)
  const pendingAreas = computed(() => statusQuery.data.value?.pendingAreas ?? [])

  const rebuild = useMutation({
    mutationFn: () => triggerRebuild(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REBUILD_QUERY_KEY }),
  })

  const setAutoRebuild = useMutation({
    mutationFn: (nextAutoRebuild: boolean) => updateSiteSettings(token.value!, nextAutoRebuild),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REBUILD_QUERY_KEY }),
  })

  return { statusQuery, isBuilding, autoRebuild, pendingAreas, rebuild, setAutoRebuild }
}
