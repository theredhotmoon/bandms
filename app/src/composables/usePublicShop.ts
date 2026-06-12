import { useQuery } from '@tanstack/vue-query'
import { fetchShopItems } from '@/api/shop'
import { fetchShopCategories } from '@/api/shop'

const STALE = 5 * 60 * 1000

export function usePublicShop() {
  const items = useQuery({
    queryKey: ['shop-items-public'],
    queryFn: fetchShopItems,
    staleTime: STALE,
  })

  const categories = useQuery({
    queryKey: ['shop-categories-public'],
    queryFn: fetchShopCategories,
    staleTime: STALE,
  })

  return { items, categories }
}
