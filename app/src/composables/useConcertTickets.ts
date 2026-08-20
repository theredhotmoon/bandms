import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useAuth } from './useAuth'
import {
  getConcertTickets,
  createTicketType, updateTicketType, deleteTicketType,
  createPriceTier, updatePriceTier, deletePriceTier,
} from '@/api/tickets'
import type { TicketTypePayload, PriceTierPayload } from '@/types/ticket'
import type { Ref } from 'vue'

export function useConcertTickets(concertId: Ref<number | null>) {
  const { token } = useAuth()
  const qc = useQueryClient()

  const qKey = computed(() => ['concert-tickets', concertId.value] as const)
  const invalidate = () => qc.invalidateQueries({ queryKey: qKey.value })

  const query = useQuery({
    queryKey: qKey,
    queryFn: () => getConcertTickets(concertId.value!),
    enabled: computed(() => concertId.value !== null),
  })

  function requireAuth(): { token: string; concertId: number } {
    if (!token.value || !concertId.value) throw new Error('Not authenticated')
    return { token: token.value, concertId: concertId.value }
  }

  const createType = useMutation({
    mutationFn: (payload: TicketTypePayload) => {
      const { token: t, concertId: cid } = requireAuth()
      return createTicketType(t, cid, payload)
    },
    onSuccess: invalidate,
  })

  const updateType = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TicketTypePayload }) => {
      const { token: t, concertId: cid } = requireAuth()
      return updateTicketType(t, cid, id, payload)
    },
    onSuccess: invalidate,
  })

  const deleteType = useMutation({
    mutationFn: (id: number) => {
      const { token: t, concertId: cid } = requireAuth()
      return deleteTicketType(t, cid, id)
    },
    onSuccess: invalidate,
  })

  const createTier = useMutation({
    mutationFn: ({ typeId, payload }: { typeId: number; payload: PriceTierPayload }) => {
      const { token: t, concertId: cid } = requireAuth()
      return createPriceTier(t, cid, typeId, payload)
    },
    onSuccess: invalidate,
  })

  const updateTier = useMutation({
    mutationFn: ({ typeId, tierId, payload }: { typeId: number; tierId: number; payload: PriceTierPayload }) => {
      const { token: t, concertId: cid } = requireAuth()
      return updatePriceTier(t, cid, typeId, tierId, payload)
    },
    onSuccess: invalidate,
  })

  const deleteTier = useMutation({
    mutationFn: ({ typeId, tierId }: { typeId: number; tierId: number }) => {
      const { token: t, concertId: cid } = requireAuth()
      return deletePriceTier(t, cid, typeId, tierId)
    },
    onSuccess: invalidate,
  })

  return { query, createType, updateType, deleteType, createTier, updateTier, deleteTier }
}
