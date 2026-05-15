import type { Ref } from 'vue'
import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchMemberSetups,
  fetchMemberSetup,
  createMemberSetup,
  updateMemberSetup,
  deleteMemberSetup,
  fetchAllMemberSetups,
} from '@/api/bandMemberSetups'
import type { BandMemberSetupPayload } from '@/types/bandMemberSetup'
import { useAuth } from './useAuth'

/** List of setups (summaries) for a single member. */
export function useMemberSetups(memberId: Ref<number | null>) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const qk = computed(() => ['member-setups', memberId.value])

  const list = useQuery({
    queryKey: qk,
    queryFn: () => fetchMemberSetups(memberId.value!),
    enabled: computed(() => memberId.value !== null),
  })

  const create = useMutation({
    mutationFn: (payload: BandMemberSetupPayload) =>
      createMemberSetup(token.value!, memberId.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.value }),
  })

  const remove = useMutation({
    mutationFn: (setupId: number) =>
      deleteMemberSetup(token.value!, memberId.value!, setupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.value }),
  })

  return { list, create, remove }
}

/** Single full setup — for the editor. */
export function useMemberSetup(
  memberId: Ref<number | null>,
  setupId: Ref<number | null>,
) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const qk = computed(() => ['member-setup', memberId.value, setupId.value])

  const query = useQuery({
    queryKey: qk,
    queryFn: () => fetchMemberSetup(memberId.value!, setupId.value!),
    enabled: computed(() => memberId.value !== null && setupId.value !== null),
  })

  const update = useMutation({
    mutationFn: (payload: BandMemberSetupPayload) =>
      updateMemberSetup(token.value!, memberId.value!, setupId.value!, payload),
    onSuccess: (updated) => {
      // Update the detail cache and invalidate the list
      queryClient.setQueryData(qk.value, updated)
      queryClient.invalidateQueries({ queryKey: ['member-setups', memberId.value] })
    },
  })

  return { query, update }
}

/** All setups for all members — used in the tech-rider import panel. */
export function useAllMemberSetups() {
  return useQuery({
    queryKey: ['all-member-setups'],
    queryFn: fetchAllMemberSetups,
  })
}
