import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchPressRelease } from '@/api/press-releases'
import type { PressRelease } from '@/types/press-release'

export function usePressRelease(id: Ref<number | null>) {
  return useQuery<PressRelease>({
    queryKey: ['press-releases', id],
    queryFn: () => fetchPressRelease(id.value!),
    enabled: computed(() => id.value !== null),
  })
}
