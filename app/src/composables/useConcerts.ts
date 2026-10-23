import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createConcert, deleteConcert, fetchConcerts, updateConcert } from '@/api/concerts'
import type { Concert, ConcertPayload } from '@/types/concert'
import { useAuth } from './useAuth'

export function useConcerts() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Concert[]>({
    queryKey: ['concerts'],
    queryFn: fetchConcerts,
  })

  const create = useMutation({
    mutationFn: (payload: ConcertPayload) => createConcert(token.value!, payload),
    // The new row goes into the list at once (a reference block or picker may
    // select it before the refetch lands); the refetch is not awaited, since
    // `mutateAsync` resolves after `onSuccess`.
    onSuccess: (concert) => {
      queryClient.setQueryData<Concert[]>(['concerts'], (old) => [...(old ?? []), concert])
      void queryClient.invalidateQueries({ queryKey: ['concerts'] })
    },
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
