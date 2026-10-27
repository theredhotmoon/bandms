import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createTour, deleteTour, fetchTours, updateTour } from '@/api/tours'
import type { TourSummary, TourPayload } from '@/types/tour'
import { appendToList } from '@/utils/queryCache'
import { useAuth } from './useAuth'

/** The create mutation on its own (no list observer); appends the row to the list cache. */
export function useCreateTour() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TourPayload) => createTour(token.value!, payload),
    onSuccess: (tour) => appendToList<TourSummary>(queryClient, ['tours'], tour),
  })
}

export function useTours() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<TourSummary[]>({
    queryKey: ['tours'],
    queryFn: fetchTours,
  })

  const create = useCreateTour()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TourPayload }) =>
      updateTour(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteTour(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours'] }),
  })

  return { query, create, update, remove }
}
