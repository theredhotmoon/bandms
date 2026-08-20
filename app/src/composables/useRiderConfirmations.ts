/**
 * Asking the band to confirm their rigs (admin), and answering (musician).
 *
 * Two composables rather than one: the admin side is scoped to a rider and the
 * musician side is scoped to a person, and nothing useful is shared between
 * them beyond the endpoint prefix.
 */
import { computed } from 'vue'
import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  confirmMyRig,
  fetchMyRiderConfirmations,
  fetchRiderConfirmations,
  requestRiderConfirmations,
} from '@/api/riderConfirmations'
import type { RiderConfirmation } from '@/types/riderConfirmation'
import { useAuth } from './useAuth'

const MINE_QK = ['my-rider-confirmations']

/** Admin: who has been asked about this rider, and who has answered. */
export function useRiderConfirmations(riderId: Ref<number | null>) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const qk = computed(() => ['rider-confirmations', riderId.value])

  const query = useQuery<RiderConfirmation[]>({
    queryKey: qk,
    queryFn: () => fetchRiderConfirmations(token.value!, riderId.value!),
    enabled: computed(() => riderId.value !== null && !!token.value),
  })

  const request = useMutation({
    mutationFn: () => requestRiderConfirmations(token.value!, riderId.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rider-confirmations', riderId.value] }),
  })

  const confirmations = computed(() => query.data.value ?? [])
  const confirmed = computed(() => confirmations.value.filter((c) => c.confirmed_at !== null))
  const waiting = computed(() => confirmations.value.filter((c) => c.confirmed_at === null))

  /** No request has gone out yet — the panel says so rather than showing 0/0. */
  const neverAsked = computed(() => confirmations.value.length === 0)

  return { query, confirmations, confirmed, waiting, neverAsked, request }
}

/** Musician: the riders still waiting on me, and the button that answers them. */
export function useMyRiderConfirmations() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<RiderConfirmation[]>({
    queryKey: MINE_QK,
    queryFn: () => fetchMyRiderConfirmations(token.value!),
    enabled: computed(() => !!token.value),
  })

  const confirm = useMutation({
    mutationFn: (riderId: number) => confirmMyRig(token.value!, riderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINE_QK }),
  })

  return { query, pending: computed(() => query.data.value ?? []), confirm }
}
