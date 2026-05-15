import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchPressRelease } from '@/api/press-releases'

export function usePressRelease(id: Ref<number | null>) {
  return useQuery({
    queryKey: ['press-releases', id],
    queryFn: () => fetchPressRelease(id.value!),
    enabled: computed(() => id.value !== null),
  })
}
