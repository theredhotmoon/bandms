import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import { fetchNewsletterSubscribers, deleteNewsletterSubscriber } from '@/api/newsletter'

export function useNewsletterSubscribers() {
  const { token } = useAuth()
  const qc   = useQueryClient()
  const page = ref(1)
  const QKEY = ['newsletter-subscribers']

  const query = useQuery({
    queryKey: computed(() => [...QKEY, page.value]),
    queryFn:  () => fetchNewsletterSubscribers(token.value!, page.value),
    enabled:  computed(() => !!token.value),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteNewsletterSubscriber(token.value!, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  return { query, remove, page }
}
