import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { fetchActivity, fetchActivityFilterOptions } from '@/api/activity'
import type { ActivityFilters } from '@/types/activity'
import { activityQueryParams, parseActivityFilters } from '@/utils/activityFilters'

/**
 * The activity log page's state. Filters live in the URL, so a record's
 * history is shareable and survives a reload; this composable is the only
 * thing that reads or writes them.
 */
export function useActivityLog() {
  const route  = useRoute()
  const router = useRouter()

  const filters = computed<ActivityFilters>(() => parseActivityFilters(route.query))

  /** Any change but paging starts again from page 1. */
  function setFilters(patch: Partial<ActivityFilters>): void {
    const next = { ...filters.value, ...patch, page: patch.page ?? 1 }
    void router.replace({ query: activityQueryParams(next) })
  }

  function clearFilters(): void {
    void router.replace({ query: {} })
  }

  const list = useQuery({
    queryKey: computed(() => ['activity', filters.value] as const),
    queryFn:  () => fetchActivity(filters.value),
    // Keep the old page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })

  const options = useQuery({
    queryKey: ['activity-filter-options'],
    queryFn:  fetchActivityFilterOptions,
    staleTime: 60_000,
  })

  const hasFilters = computed(() =>
    Object.keys(activityQueryParams({ ...filters.value, page: 1 })).length > 0)

  return { filters, setFilters, clearFilters, hasFilters, list, options }
}
