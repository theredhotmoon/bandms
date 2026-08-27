import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchFaqs, createFaq, updateFaq, deleteFaq, reorderFaqs } from '@/api/faqs'
import { useAuth } from './useAuth'
import type { FaqPayload } from '@/types/faq'

const FAQS_KEY = ['faqs'] as const

export function useFaqs() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: FAQS_KEY,
    queryFn: () => fetchFaqs(token.value!),
    enabled: () => token.value !== null,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: FAQS_KEY })

  const create = useMutation({
    mutationFn: (payload: FaqPayload) => createFaq(token.value!, payload),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FaqPayload }) =>
      updateFaq(token.value!, id, payload),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteFaq(token.value!, id),
    onSuccess: invalidate,
  })

  const reorder = useMutation({
    mutationFn: ({ moduleSlug, ids }: { moduleSlug: string; ids: number[] }) =>
      reorderFaqs(token.value!, moduleSlug, ids),
    // The endpoint returns the full list already ordered, so seeding the cache
    // avoids a refetch that would briefly snap rows back to their old order.
    onSuccess: (data) => queryClient.setQueryData(FAQS_KEY, data),
  })

  return { query, create, update, remove, reorder }
}
