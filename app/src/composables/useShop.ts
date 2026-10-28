import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchShopItemsAdmin,
  createShopItem,
  updateShopItem,
  deleteShopItem,
  uploadShopPhoto,
  deleteShopPhoto,
  reorderShopPhotos,
  fetchShopCurrencies,
  updateShopCurrencies,
  createShopVariant,
  updateShopVariant,
  deleteShopVariant,
} from '@/api/shop'
import type { ShopItemPayload, ShopItemSummary } from '@/types/shop'
import type { ShopItemVariantPayload } from '@/api/shop'
import { appendToList } from '@/utils/queryCache'
import { useAuth } from './useAuth'

const SHOP_ITEMS_KEY = ['shop-items']

/** The create mutation on its own (no list observer); appends the row to the list cache. */
export function useCreateShopItem() {
  const { token } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: ShopItemPayload) => createShopItem(token.value!, payload),
    onSuccess: (item) => appendToList<ShopItemSummary>(qc, SHOP_ITEMS_KEY, item),
  })
}

export function useShop() {
  const { token } = useAuth()
  const qc = useQueryClient()
  const qk = SHOP_ITEMS_KEY
  const itemQk = ['shop-item']
  const ckk = ['shop-currencies']

  function invalidateItems() {
    qc.invalidateQueries({ queryKey: qk })
    qc.invalidateQueries({ queryKey: itemQk })
  }

  const query = useQuery({
    queryKey: qk,
    queryFn: () => fetchShopItemsAdmin(token.value!),
    enabled: computed(() => !!token.value),
  })

  const currenciesQuery = useQuery({
    queryKey: ckk,
    queryFn: () => fetchShopCurrencies(token.value!),
    enabled: computed(() => !!token.value),
  })

  const create = useCreateShopItem()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ShopItemPayload }) =>
      updateShopItem(token.value!, id, payload),
    onSuccess: invalidateItems,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteShopItem(token.value!, id),
    onSuccess: invalidateItems,
  })

  const addPhoto = useMutation({
    mutationFn: ({ itemId, file }: { itemId: number; file: File }) =>
      uploadShopPhoto(token.value!, itemId, file),
    onSuccess: invalidateItems,
  })

  const removePhoto = useMutation({
    mutationFn: ({ itemId, photoId }: { itemId: number; photoId: number }) =>
      deleteShopPhoto(token.value!, itemId, photoId),
    onSuccess: invalidateItems,
  })

  const reorderPhotos = useMutation({
    mutationFn: ({ itemId, ids }: { itemId: number; ids: number[] }) =>
      reorderShopPhotos(token.value!, itemId, ids),
    onSuccess: invalidateItems,
  })

  const saveCurrencies = useMutation({
    mutationFn: (currencies: string[]) => updateShopCurrencies(token.value!, currencies),
    onSuccess: () => qc.invalidateQueries({ queryKey: ckk }),
  })

  const addVariant = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: ShopItemVariantPayload }) =>
      createShopVariant(token.value!, itemId, payload),
    onSuccess: invalidateItems,
  })

  const editVariant = useMutation({
    mutationFn: ({ itemId, variantId, payload }: { itemId: number; variantId: number; payload: ShopItemVariantPayload }) =>
      updateShopVariant(token.value!, itemId, variantId, payload),
    onSuccess: invalidateItems,
  })

  const removeVariant = useMutation({
    mutationFn: ({ itemId, variantId }: { itemId: number; variantId: number }) =>
      deleteShopVariant(token.value!, itemId, variantId),
    onSuccess: invalidateItems,
  })

  return { query, currenciesQuery, create, update, remove, addPhoto, removePhoto, reorderPhotos, saveCurrencies, addVariant, editVariant, removeVariant }
}
