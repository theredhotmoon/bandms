import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchRelease } from '@/api/releases'
import type { Release } from '@/types/release'
import { useLang } from './useLang'

export function useRelease(id: Ref<number | null>) {
  const { lang } = useLang()
  const qk = computed(() => ['releases', id.value, lang.value])
  return useQuery<Release>({
    queryKey: qk,
    queryFn: () => fetchRelease(id.value!, lang.value),
    enabled: computed(() => id.value !== null),
  })
}
