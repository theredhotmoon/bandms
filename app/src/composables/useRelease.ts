import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchRelease } from '@/api/releases'
import type { Release } from '@/types/release'

export function useRelease(id: Ref<number | null>) {
  return useQuery<Release>({
    queryKey: ['releases', id],
    queryFn: () => fetchRelease(id.value!),
    enabled: computed(() => id.value !== null),
  })
}
