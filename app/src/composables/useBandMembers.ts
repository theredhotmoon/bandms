import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createBandMember,
  deleteBandMember,
  fetchBandMembers,
  reorderBandMembers,
  updateBandMember,
  uploadMemberPhoto,
} from '@/api/bandMembers'
import type { BandMember, BandMemberPayload } from '@/types/bandMember'
import { useAuth } from './useAuth'

export function useBandMembers() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const qk = ['band-profile-members']

  const query = useQuery<BandMember[]>({ queryKey: qk, queryFn: fetchBandMembers })

  const create = useMutation({
    mutationFn: (payload: BandMemberPayload) => createBandMember(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<BandMemberPayload> }) =>
      updateBandMember(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteBandMember(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const uploadPhoto = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      uploadMemberPhoto(token.value!, id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const reorder = useMutation({
    mutationFn: (ids: number[]) => reorderBandMembers(token.value!, ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  return { query, create, update, remove, uploadPhoto, reorder }
}
