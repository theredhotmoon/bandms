import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createConcert, deleteConcert, fetchConcerts, updateConcert, uploadConcertPoster } from '@/api/concerts'
import type { Concert, ConcertPayload } from '@/types/concert'
import { appendToList } from '@/utils/queryCache'
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
 * post block's quick-add share. The concert stands whatever happens to the
 * poster: a failed upload is reported on its own and the concert is still
 * returned, so the caller closes and selects it instead of leaving a form
 * open whose second Create would make a duplicate.
 */
export function useCreateConcertWithPoster() {
  const { token } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const create = useCreateConcert()

  return async (payload: ConcertPayload, posterFile: File | null): Promise<Concert> => {
    const concert = await create.mutateAsync(payload)
    if (posterFile) {
      try {
        await uploadConcertPoster(token.value!, concert.id, posterFile)
        await queryClient.invalidateQueries({ queryKey: ['concerts'] })
      } catch (e) {
        reportSaveError(e, t('shows.concerts.posterFailed'))
      }
    }
    return concert
  }
}

export function useConcerts() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Concert[]>({
    queryKey: ['concerts'],
    queryFn: fetchConcerts,
  })

  const create = useCreateConcert()
  const createWithPoster = useCreateConcertWithPoster()

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
