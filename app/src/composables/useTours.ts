import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createTour, deleteTour, fetchTours, updateTour } from '@/api/tours'
import type { TourPayload } from '@/types/tour'
import { useAuth } from './useAuth'

export function useTours() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['tours'],
    queryFn: fetchTours,
  })

  const create = useMutation({
    mutationFn: (payload: TourPayload) => createTour(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours'] }),
  })

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
