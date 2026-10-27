import { computed, watch, type ComputedRef } from 'vue'
import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/vue-query'
import { fetchContentLocaleOrder, updateContentLocaleOrder } from '@/api/contentLocales'
import { LOCALES, isLocale, type Lang } from '@/locales'
import { useAuth } from './useAuth'
import { useLang } from './useLang'

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
  const queryClient = useQueryClient()
  const { token } = useAuth()
  const order = useContentLocaleOrder()
  const primary = computed<Lang>(() => order.value[0])

  const save = useMutation<Lang[], Error, Lang[]>({
    mutationFn: (next) => updateContentLocaleOrder(token.value!, next),
    onSuccess: (saved) => queryClient.setQueryData(QUERY_KEY, saved),
  })

  return { order, primary, isPrimary: (l: Lang) => l === primary.value, save }
}

/**
 * The order alone, read-only — for surfaces that only display in it (tag
 * labels in every picker and list). Same query and cache as
 * `useContentLocales()`, without the save mutation each caller would
 * otherwise create and never use.
 */
export function useContentLocaleOrder(): ComputedRef<Lang[]> {
  const query = useContentLocaleQuery()
  return computed<Lang[]>(() => query.data.value ?? [...LOCALES])
}

/**
 * Keeps `useLang()` — the locale every admin fetch resolves content in — on
 * the band's first content language, so a list row reads in the language the
 * band writes in, the rule tag labels and FAQ rows already follow. Mount it
 * once, in the signed-in shell.
 *
 * Only a loaded order counts: the registry order that stands in while loading
 * would flip a Polish-first band to English and back on every page load. When
 * the language does change, every cached query whose key does not carry it was
 * fetched in the old one, so those are refetched.
 */
export function useContentLangSync(): void {
  const query = useContentLocaleQuery()
  const { lang, setLang } = useLang()
  const queryClient = useQueryClient()

  watch(() => query.data.value?.[0], (primary) => {
    if (!primary || primary === lang.value) return
    setLang(primary)
    // Cancel first: a query still on its *first* fetch is not restarted by
    // invalidateQueries — the refetch joins the in-flight request, whose
    // answer in the old language then lands as fresh. Cancelling drops it.
    // Keys that carry the language (posts, releases, profile) move to a new
    // key on their own; refetching their old one too would double the burst.
    const others = { predicate: (q: Query) => q.queryKey[0] !== QUERY_KEY[0] && !q.queryKey.some(isLocale) }
    void queryClient.cancelQueries(others).then(() => queryClient.invalidateQueries(others))
  }, { immediate: true })
}

function useContentLocaleQuery() {
  const { token } = useAuth()
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchContentLocaleOrder(token.value!),
    enabled: () => token.value !== null,
    // Changes only when an admin saves it, and the save writes the cache.
    staleTime: Infinity,
  })
}
