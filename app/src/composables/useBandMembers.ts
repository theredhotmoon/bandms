import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createBandMember, deleteBandMember, fetchBandMembers, updateBandMember } from '@/api/bandMembers'
import type { BandMemberPayload } from '@/types/bandMember'
import { useAuth } from './useAuth'

export function useBandMembers() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const qk = ['band-profile-members']

  const query = useQuery({ queryKey: qk, queryFn: fetchBandMembers })

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

  return { query, create, update, remove }
}
