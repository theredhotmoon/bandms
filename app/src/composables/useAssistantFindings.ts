import { computed, ref } from 'vue'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import {
  fetchAssistantSummary, fetchBlockedSites, fetchCrawlRuns, fetchFindings, linkSavedFinding, runCrawl, setFindingStatus, unblockSite,
} from '@/api/assistantFindings'
import type { FindingStatusChange, FindingsFilter } from '@/types/assistantCrawler'
import { withFilter } from '@/utils/findingsFilters'

const QKEY = ['assistant-findings']
const SUMMARY_KEY = ['assistant-summary']
const BLOCKED_KEY = ['assistant-blocked-sites']

/** The inbox: the filtered page of findings, the filter itself, and Not now / Wrong / Restore. */
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
    mutationFn: ({ id, change }: { id: number; change: FindingStatusChange }) =>
      setFindingStatus(token.value!, id, change),
    onSuccess: ({ meta }) => Promise.all([
      qc.invalidateQueries({ queryKey: QKEY }),
      qc.invalidateQueries({ queryKey: SUMMARY_KEY }),
      // Only a block changes that list; Not now, Restore and a plain Wrong do not.
      meta.blocked ? qc.invalidateQueries({ queryKey: BLOCKED_KEY }) : null,
    ]),
  })

  const link = useMutation({
    mutationFn: ({ id, type, recordId }: { id: number; type: 'venue' | 'band' | 'author'; recordId: number }) =>
      linkSavedFinding(token.value!, id, type, recordId),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: QKEY }),
      qc.invalidateQueries({ queryKey: SUMMARY_KEY }),
    ]),
  })

  function change(next: Partial<FindingsFilter>): void {
    filter.value = withFilter(filter.value, next)
  }

  return { query, filter, change, setStatus, link }
}

/** The sites "Wrong" blocked, and Unblock — which lets new findings in again, nothing more. */
export function useBlockedSites() {
  const { token } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: BLOCKED_KEY,
    queryFn: () => fetchBlockedSites(token.value!),
    enabled: computed(() => !!token.value),
  })

  const unblock = useMutation({
    mutationFn: (id: number) => unblockSite(token.value!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOCKED_KEY }),
  })

  return { query, unblock }
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

/**
 * The dashboard widget's numbers. Admins only — the dashboard is shared with
 * members, and the endpoint would 403 them — so for anyone else the query
 * never runs and the widget renders nothing.
 */
export function useAssistantSummary() {
  const { token, isAdmin } = useAuth()
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => fetchAssistantSummary(token.value!),
    enabled: computed(() => !!token.value && isAdmin.value),
  })
}
