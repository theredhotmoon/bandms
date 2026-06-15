import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchBandProfile, updateBandProfile,
  uploadTechRider, deleteTechRider,
  uploadStagePlot, deleteStagePlot,
  syncFacebookLikes,
} from '@/api/bandProfile'
import type { BandProfile, BandProfilePayload, FacebookSyncResult } from '@/types/bandProfile'
import { useAuth } from './useAuth'
import { useLang } from './useLang'

export function useBandProfile() {
  const { token } = useAuth()
  const { lang } = useLang()
  const queryClient = useQueryClient()
  const qk = computed(() => ['band-profile', lang.value])

  const query = useQuery<BandProfile>({ queryKey: qk, queryFn: () => fetchBandProfile(lang.value) })

  const update = useMutation({
    mutationFn: (payload: BandProfilePayload) => updateBandProfile(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  const uploadRider = useMutation({
    mutationFn: (file: File) => uploadTechRider(token.value!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  const deleteRider = useMutation({
    mutationFn: () => deleteTechRider(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  const uploadPlot = useMutation({
    mutationFn: (file: File) => uploadStagePlot(token.value!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  const deletePlot = useMutation({
    mutationFn: () => deleteStagePlot(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  const syncFb = useMutation<FacebookSyncResult>({
    mutationFn: () => syncFacebookLikes(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  return { query, update, uploadRider, deleteRider, uploadPlot, deletePlot, syncFb }
}
