import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchShopItem } from '@/api/shop'
import type { ShopItem } from '@/types/shop'

export function useShopItem(id: Ref<number | null>) {
  return useQuery<ShopItem>({
    queryKey: ['shop-item', id],
    queryFn: () => fetchShopItem(id.value!),
    enabled: computed(() => id.value !== null),
  })
}
