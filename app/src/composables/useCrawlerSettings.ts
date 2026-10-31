import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import { fetchCrawlerSettings, saveCrawlerSettings } from '@/api/assistantFindings'
import { searchSetlistFmArtist } from '@/api/setlists'
import type { CrawlerSettings } from '@/types/assistantCrawler'
import { normaliseCrawlerSettings } from '@/utils/crawlerSettings'

const QKEY = ['assistant-crawler-settings']

/** The crawler's settings page: read, and save (normalised first). Superadmin-only on the server. */
export function useCrawlerSettings() {
  const { token } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: QKEY,
    queryFn: () => fetchCrawlerSettings(token.value!),
    enabled: computed(() => !!token.value),
    retry: false,
  })

  const save = useMutation({
    mutationFn: (s: CrawlerSettings) => saveCrawlerSettings(token.value!, normaliseCrawlerSettings(s)),
    onSuccess: data => qc.setQueryData(QKEY, data),
  })

  /** setlist.fm artist search, for the sibling-band picker. */
  const searchArtists = (q: string) => searchSetlistFmArtist(token.value!, q)

  return { query, save, searchArtists }
}
