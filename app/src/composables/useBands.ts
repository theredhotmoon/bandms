import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createBand, deleteBand, fetchBands, updateBand } from '@/api/bands'
import type { Band, BandPayload } from '@/types/band'
import { useAuth } from './useAuth'

/**
 * The create mutation on its own (the assistant inbox's Save as band), so a
 * caller that never lists bands adds no list observer.
 */
export function useCreateBand() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BandPayload) => createBand(token.value!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bands'] })
      queryClient.invalidateQueries({ queryKey: ['authors'] })
    },
  })
}

export function useBands() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Band[]>({
    queryKey: ['bands'],
    queryFn: () => fetchBands(token.value!),
    enabled: () => !!token.value,
  })

  // Band writes touch `author_bands`, so cached authors (and any open author
  // detail) are stale afterwards — a stale detail would re-submit old band_ids.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bands'] })
    queryClient.invalidateQueries({ queryKey: ['authors'] })
  }

  const create = useCreateBand()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BandPayload }) =>
      updateBand(token.value!, id, payload),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteBand(token.value!, id),
    onSuccess: invalidate,
  })

  return { query, create, update, remove }
}
