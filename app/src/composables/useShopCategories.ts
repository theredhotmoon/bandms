import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchShopCategories,
  createShopCategory,
  updateShopCategory,
  deleteShopCategory,
} from '@/api/shop'
import { useAuth } from './useAuth'

export function useShopCategories() {
  const { token } = useAuth()
  const qc = useQueryClient()
  const qk = ['shop-categories']

  const query = useQuery({
    queryKey: qk,
    queryFn: () => fetchShopCategories(),
  })

  const create = useMutation({
    mutationFn: (payload: Parameters<typeof createShopCategory>[1]) =>
      createShopCategory(token.value!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateShopCategory>[2] }) =>
      updateShopCategory(token.value!, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteShopCategory(token.value!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  return { query, create, update, remove }
}
