import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchTour } from '@/api/tours'
import type { Tour } from '@/types/tour'

export function useTour(id: Ref<number | null>) {
  return useQuery<Tour>({
    queryKey: ['tours', id],
    queryFn: () => fetchTour(id.value!),
    enabled: computed(() => id.value !== null),
  })
}
