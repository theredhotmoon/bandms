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
    // 'unknown' is the API failing to reach the webhook (a 5 s timeout, a
    // restart) — often one blip in the middle of a build, so keep checking
    // briskly rather than dropping to the idle pace.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'building' ? 2000 : status === 'unknown' ? 5000 : 30000
    },
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
