import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createBand, deleteBand, fetchBands, updateBand } from '@/api/bands'
import type { Band, BandPayload } from '@/types/band'
import { useAuth } from './useAuth'

export function useBands() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Band[]>({
    queryKey: ['bands'],
    queryFn: fetchBands,
  })

  const create = useMutation({
    mutationFn: (payload: BandPayload) => createBand(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bands'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BandPayload }) =>
      updateBand(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bands'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteBand(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bands'] }),
  })

  return { query, create, update, remove }
}
