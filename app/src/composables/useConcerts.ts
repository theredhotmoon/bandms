import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createConcert, deleteConcert, fetchConcerts, updateConcert, uploadConcertPoster } from '@/api/concerts'
import type { Concert, ConcertPayload } from '@/types/concert'
import { appendToList } from '@/utils/queryCache'
import { createThenUpload } from '@/utils/createThenUpload'
import { reportSaveError } from '@/utils/formErrors'
import { useAuth } from './useAuth'

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
 * quick-add share (see createThenUpload for the policy). Pass the page's own
 * `create` so its `isPending` covers this path too; without one, a private
 * mutation is used.
 */
export function useCreateConcertWithPoster(create = useCreateConcert()) {
  const { token } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()

  return (payload: ConcertPayload, posterFile: File | null): Promise<Concert> =>
    createThenUpload(
      () => create.mutateAsync(payload),
      posterFile && (async (concert) => {
        await uploadConcertPoster(token.value!, concert.id, posterFile)
        void queryClient.invalidateQueries({ queryKey: ['concerts'] })
      }),
      (e) => reportSaveError(e, t('shows.concerts.posterFailed')),
    )
}

export function useConcerts() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Concert[]>({
    queryKey: ['concerts'],
    queryFn: fetchConcerts,
  })

  const create = useCreateConcert()
  const createWithPoster = useCreateConcertWithPoster(create)

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ConcertPayload> }) =>
      updateConcert(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concerts'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteConcert(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concerts'] }),
  })

  return { query, create, createWithPoster, update, remove }
}
