import { defineStore } from 'pinia'
import type { CartItem, CartItemSnapshot } from '@/types/cart'

function cartKey(shopItemId: number, variantId: number | null): string {
  return `${shopItemId}:${variantId ?? 'null'}`
}

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem('cart')
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i): i is CartItem =>
        typeof i?.shop_item_id === 'number' &&
        typeof i?.quantity === 'number' &&
        typeof i?.snapshot?.currency === 'string' &&
        typeof i?.snapshot?.price === 'number' &&
        typeof i?.snapshot?.name === 'string',
    )
  } catch {
    return []
  }
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: loadFromStorage() as CartItem[],
    isDrawerOpen: false,
    selectedCurrency: null as string | null,
  }),

  getters: {
    itemCount: (state): number => state.items.reduce((sum, i) => sum + i.quantity, 0),
    isEmpty: (state): boolean => state.items.length === 0,
    total: (state) => (currency: string): number =>
      state.items
        .filter(i => i.snapshot.currency === currency)
        .reduce((sum, i) => sum + i.snapshot.price * i.quantity, 0),
    currencies: (state): string[] =>
      [...new Set(state.items.map(i => i.snapshot.currency))],
  },

  actions: {
    addItem(shopItemId: number, variantId: number | null, snapshot: CartItemSnapshot) {
      const key = cartKey(shopItemId, variantId)
      const existing = this.items.find(
        i => cartKey(i.shop_item_id, i.variant_id) === key,
      )
      if (existing) {
        existing.quantity += 1
      } else {
        this.items.push({ shop_item_id: shopItemId, variant_id: variantId, quantity: 1, snapshot })
      }
      this._persist()
    },

    removeItem(shopItemId: number, variantId: number | null) {
      const key = cartKey(shopItemId, variantId)
      this.items = this.items.filter(i => cartKey(i.shop_item_id, i.variant_id) !== key)
      this._persist()
    },

    updateQuantity(shopItemId: number, variantId: number | null, quantity: number) {
      if (quantity < 1) { this.removeItem(shopItemId, variantId); return }
      const key = cartKey(shopItemId, variantId)
      const item = this.items.find(i => cartKey(i.shop_item_id, i.variant_id) === key)
      if (item) { item.quantity = quantity; this._persist() }
    },

    clearCart() {
      this.items = []
      this._persist()
    },

    openDrawer() { this.isDrawerOpen = true },
    closeDrawer() { this.isDrawerOpen = false },
    setCurrency(c: string) { this.selectedCurrency = c },

    _persist() {
      localStorage.setItem('cart', JSON.stringify(this.items))
    },
  },
})
