import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createConcert, deleteConcert, fetchConcerts, updateConcert, uploadConcertPoster } from '@/api/concerts'
import type { Concert, ConcertPayload } from '@/types/concert'
import { appendToList } from '@/utils/queryCache'
import { useAuth } from './useAuth'
import { useCreateWithUpload } from './useCreateWithUpload'

/** The create mutation on its own (no list observer); appends the row to the list cache. */
export function useCreateConcert() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ConcertPayload) => createConcert(token.value!, payload),
    onSuccess: (concert) => appendToList(queryClient, ['concerts'], concert),
  })
}

/**
 * Create, then the poster — the one save sequence the concerts page and the
 * quick-add share (see useCreateWithUpload). The page passes its own
 * `create` so its `isPending` covers this path; the quick-add passes none.
 */
export function useCreateConcertWithPoster(create = useCreateConcert()) {
  const { token } = useAuth()
  const { t } = useI18n()
  return useCreateWithUpload<ConcertPayload, Concert>({
    create: (payload) => create.mutateAsync(payload),
    upload: (concert, file) => uploadConcertPoster(token.value!, concert.id, file),
    invalidateKey: ['concerts'],
    failureMessage: () => t('shows.concerts.posterFailed'),
  })
}

export function useConcerts() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Concert[]>({
    queryKey: ['concerts'],
    queryFn: fetchConcerts,
  })

  const create = useCreateConcert()

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
