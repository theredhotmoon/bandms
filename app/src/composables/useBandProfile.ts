import { computed, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchBandProfile, updateBandProfile, syncFacebookLikes } from '@/api/bandProfile'
import type { BandProfile, BandProfilePayload, FacebookSyncResult } from '@/types/bandProfile'
import { useAuth } from './useAuth'
import { useLang } from './useLang'
import { setTitleBandName } from '@/utils/documentTitle'

export function useBandProfile() {
  const { token } = useAuth()
  const { lang } = useLang()
  const queryClient = useQueryClient()
  const qk = computed(() => ['band-profile', lang.value])

  const query = useQuery<BandProfile>({ queryKey: qk, queryFn: () => fetchBandProfile(lang.value) })

  // The document title's suffix. Set here rather than in a layout because
  // router.afterEach runs outside every component, and this is the one place
  // that always knows the name whichever view triggered the fetch.
  watch(() => query.data.value?.name, (name) => setTitleBandName(name), { immediate: true })

  const update = useMutation({
    mutationFn: (payload: BandProfilePayload) => updateBandProfile(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  const syncFb = useMutation<FacebookSyncResult>({
    mutationFn: () => syncFacebookLikes(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  return { query, update, syncFb }
}
