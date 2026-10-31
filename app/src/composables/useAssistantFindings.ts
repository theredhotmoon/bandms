import { computed, ref } from 'vue'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import { fetchCrawlRuns, fetchFindings, runCrawl, setFindingStatus } from '@/api/assistantFindings'
import type { FindingsFilter } from '@/types/assistantCrawler'
import { withFilter } from '@/utils/findingsFilters'

const QKEY = ['assistant-findings']

/** The inbox: the filtered page of findings, the filter itself, and dismiss/restore. */
export function useAssistantFindings() {
  const { token } = useAuth()
  const qc = useQueryClient()
  const filter = ref<FindingsFilter>({ kind: null, country: null, status: 'new', q: '', page: 1 })

  const query = useQuery({
    queryKey: computed(() => [...QKEY, { ...filter.value }]),
    queryFn: () => fetchFindings(token.value!, filter.value),
    enabled: computed(() => !!token.value),
    // Keep the old page on screen while a chip's answer loads, so the list
    // does not flash empty on every click.
    placeholderData: keepPreviousData,
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'new' | 'dismissed' }) =>
      setFindingStatus(token.value!, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  function change(next: Partial<FindingsFilter>): void {
    filter.value = withFilter(filter.value, next)
  }

  return { query, filter, change, setStatus }
}

/** Each source's last run, for the status bar above the inbox, and Run now. */
export function useCrawlRuns() {
  const { token } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['assistant-runs'],
    queryFn: () => fetchCrawlRuns(token.value!),
    enabled: computed(() => !!token.value),
  })

  // The jobs are queued, not awaited: on production they finish a minute or
  // two later. Refetching now shows whatever already ran (all of it on a
  // stack with a sync queue); the bar refreshes again on window focus.
  const run = useMutation({
    mutationFn: () => runCrawl(token.value!),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['assistant-runs'] }),
      qc.invalidateQueries({ queryKey: QKEY }),
    ]),
  })

  return { query, run }
}
