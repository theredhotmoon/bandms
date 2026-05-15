import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchBandProfile, updateBandProfile,
  uploadTechRider, deleteTechRider,
  uploadStagePlot, deleteStagePlot,
} from '@/api/bandProfile'
import type { BandProfile, BandProfilePayload } from '@/types/bandProfile'
import { useAuth } from './useAuth'

export function useBandProfile() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const qk = ['band-profile']

  const query = useQuery<BandProfile>({ queryKey: qk, queryFn: fetchBandProfile })

  const update = useMutation({
    mutationFn: (payload: BandProfilePayload) => updateBandProfile(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const uploadRider = useMutation({
    mutationFn: (file: File) => uploadTechRider(token.value!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const deleteRider = useMutation({
    mutationFn: () => deleteTechRider(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const uploadPlot = useMutation({
    mutationFn: (file: File) => uploadStagePlot(token.value!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const deletePlot = useMutation({
    mutationFn: () => deleteStagePlot(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  return { query, update, uploadRider, deleteRider, uploadPlot, deletePlot }
}
