import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchContentLocaleOrder, updateContentLocaleOrder } from '@/api/contentLocales'
import { LOCALES, type Lang } from '@/locales'
import { useAuth } from './useAuth'

const QUERY_KEY = ['content-locales']

/**
 * The band's content-language order — which language they write in first.
 *
 * Every translated input group renders in this order, and only the first
 * (`primary`) language's field is required. It is NOT the public site's default
 * locale and NOT the admin's own UI language (`useUiLang`); see
 * `App\Support\ContentLocales` for why those are three separate settings.
 *
 * While the query is loading, or if it fails, the registry order stands in.
 * That is the order every form used before this setting existed, so a slow or
 * failed request degrades to the old behaviour rather than to a form with no
 * inputs.
 */
export function useContentLocales() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchContentLocaleOrder(token.value!),
    enabled: () => token.value !== null,
    // Changes only when an admin saves it, and the save writes the cache.
    staleTime: Infinity,
  })

  const order = computed<Lang[]>(() => query.data.value ?? [...LOCALES])
  const primary = computed<Lang>(() => order.value[0])

  const save = useMutation<Lang[], Error, Lang[]>({
    mutationFn: (next) => updateContentLocaleOrder(token.value!, next),
    onSuccess: (saved) => queryClient.setQueryData(QUERY_KEY, saved),
  })

  return { order, primary, isPrimary: (l: Lang) => l === primary.value, save }
}
