import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchBandLogos,
  uploadBandLogo,
  updateBandLogo,
  setDefaultLogo,
  deleteBandLogo,
} from '@/api/bandLogos'
import type { BandLogo, BandLogoPayload } from '@/types/bandLogo'
import { useAuth } from './useAuth'

export function useBandLogos() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const qk = ['band-logos']
  const profileQk = ['band-profile']

  const list = useQuery<BandLogo[]>({
    queryKey: qk,
    queryFn: () => fetchBandLogos(token.value!),
  })

  const upload = useMutation({
    mutationFn: ({
      file,
      meta,
    }: {
      file: File
      meta: Omit<BandLogoPayload, 'is_deprecated' | 'sort_order'>
    }) => uploadBandLogo(token.value!, file, meta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk })
      queryClient.invalidateQueries({ queryKey: profileQk })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BandLogoPayload }) =>
      updateBandLogo(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const setDefault = useMutation({
    mutationFn: (id: number) => setDefaultLogo(token.value!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk })
      queryClient.invalidateQueries({ queryKey: profileQk })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteBandLogo(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  return { list, upload, update, setDefault, remove }
}
