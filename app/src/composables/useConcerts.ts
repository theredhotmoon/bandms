import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createConcert, deleteConcert, fetchConcerts, updateConcert } from '@/api/concerts'
import type { ConcertPayload } from '@/types/concert'
import { useAuth } from './useAuth'

export function useConcerts() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['concerts'],
    queryFn: fetchConcerts,
  })

  const create = useMutation({
    mutationFn: (payload: ConcertPayload) => createConcert(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concerts'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ConcertPayload> }) =>
      updateConcert(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concerts'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteConcert(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concerts'] }),
  })

  return { query, create, update, remove }
}
