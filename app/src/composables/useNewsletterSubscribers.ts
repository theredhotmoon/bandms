import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/api/client'
import {
  fetchNewsletterSubscribers,
  deleteNewsletterSubscriber,
  updateNewsletterSubscriber,
  type NewsletterSubscriberUpdate,
} from '@/api/newsletter'

export function useNewsletterSubscribers() {
  const { token } = useAuth()
  const qc   = useQueryClient()
  const page = ref(1)
  const QKEY = ['newsletter-subscribers']

  const query = useQuery({
    queryKey: computed(() => [...QKEY, page.value]),
    queryFn:  () => fetchNewsletterSubscribers(token.value!, page.value),
    enabled:  computed(() => !!token.value),
    // A 403 (not a superadmin) will not change on retry — show it at once.
    retry:    (count, error) => !(error instanceof ApiError && error.status === 403) && count < 3,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteNewsletterSubscriber(token.value!, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: NewsletterSubscriberUpdate }) =>
      updateNewsletterSubscriber(token.value!, id, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  return { query, remove, update, page }
}
