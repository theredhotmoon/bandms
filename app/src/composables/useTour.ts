import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchTour } from '@/api/tours'

export function useTour(id: Ref<number | null>) {
  return useQuery({
    queryKey: ['tours', id],
    queryFn: () => fetchTour(id.value!),
    enabled: computed(() => id.value !== null),
  })
}
