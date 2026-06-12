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
import type { ShopItemPayload } from '@/types/shop'
import type { ShopItemVariantPayload } from '@/api/shop'
import { useAuth } from './useAuth'

export function useShop() {
  const { token } = useAuth()
  const qc = useQueryClient()
  const qk = ['shop-items']
  const ckk = ['shop-currencies']

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

  const create = useMutation({
    mutationFn: (payload: ShopItemPayload) => createShopItem(token.value!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ShopItemPayload }) =>
      updateShopItem(token.value!, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteShopItem(token.value!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const addPhoto = useMutation({
    mutationFn: ({ itemId, file }: { itemId: number; file: File }) =>
      uploadShopPhoto(token.value!, itemId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const removePhoto = useMutation({
    mutationFn: ({ itemId, photoId }: { itemId: number; photoId: number }) =>
      deleteShopPhoto(token.value!, itemId, photoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const reorderPhotos = useMutation({
    mutationFn: ({ itemId, ids }: { itemId: number; ids: number[] }) =>
      reorderShopPhotos(token.value!, itemId, ids),
  })

  const saveCurrencies = useMutation({
    mutationFn: (currencies: string[]) => updateShopCurrencies(token.value!, currencies),
    onSuccess: () => qc.invalidateQueries({ queryKey: ckk }),
  })

  const addVariant = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: ShopItemVariantPayload }) =>
      createShopVariant(token.value!, itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const editVariant = useMutation({
    mutationFn: ({ itemId, variantId, payload }: { itemId: number; variantId: number; payload: ShopItemVariantPayload }) =>
      updateShopVariant(token.value!, itemId, variantId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  const removeVariant = useMutation({
    mutationFn: ({ itemId, variantId }: { itemId: number; variantId: number }) =>
      deleteShopVariant(token.value!, itemId, variantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  })

  return { query, currenciesQuery, create, update, remove, addPhoto, removePhoto, reorderPhotos, saveCurrencies, addVariant, editVariant, removeVariant }
}
