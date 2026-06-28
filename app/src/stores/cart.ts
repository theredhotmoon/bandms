import { defineStore } from 'pinia'
import type { CartItem, CartItemSnapshot } from '@/types/cart'

export function itemKey(item: CartItem): string {
  if (item.type === 'ticket') {
    return `ticket:${item.ticket_type_id}:${item.ticket_price_tier_id}`
  }
  return `shop:${item.shop_item_id}:${item.variant_id ?? 'null'}`
}

function shopKey(shopItemId: number, variantId: number | null): string {
  return `shop:${shopItemId}:${variantId ?? 'null'}`
}

function ticketKey(ticketTypeId: number, tierId: number): string {
  return `ticket:${ticketTypeId}:${tierId}`
}

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem('cart')
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i): i is CartItem =>
        typeof i?.quantity === 'number' &&
        typeof i?.snapshot?.currency === 'string' &&
        typeof i?.snapshot?.price === 'number' &&
        typeof i?.snapshot?.name === 'string',
    ).map(i => ({
      ...i,
      type: i.type ?? 'shop',
      shop_item_id: i.shop_item_id ?? null,
      variant_id: i.variant_id ?? null,
      ticket_type_id: i.ticket_type_id ?? null,
      ticket_price_tier_id: i.ticket_price_tier_id ?? null,
    }))
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
    hasOnlyTickets: (state): boolean =>
      state.items.length > 0 && state.items.every(i => i.type === 'ticket'),
  },

  actions: {
    // ── Shop items (backward-compat API) ─────────────────────────────────

    addItem(shopItemId: number, variantId: number | null, snapshot: CartItemSnapshot) {
      const key = shopKey(shopItemId, variantId)
      const existing = this.items.find(i => itemKey(i) === key)
      if (existing) {
        existing.quantity += 1
      } else {
        this.items.push({
          type: 'shop',
          shop_item_id: shopItemId,
          variant_id: variantId,
          ticket_type_id: null,
          ticket_price_tier_id: null,
          quantity: 1,
          snapshot,
        })
      }
      this._persist()
    },

    removeItem(shopItemId: number, variantId: number | null) {
      const key = shopKey(shopItemId, variantId)
      this.items = this.items.filter(i => itemKey(i) !== key)
      this._persist()
    },

    updateQuantity(shopItemId: number, variantId: number | null, quantity: number) {
      if (quantity < 1) { this.removeItem(shopItemId, variantId); return }
      const key = shopKey(shopItemId, variantId)
      const item = this.items.find(i => itemKey(i) === key)
      if (item) { item.quantity = quantity; this._persist() }
    },

    // ── Ticket items ─────────────────────────────────────────────────────

    addTicket(ticketTypeId: number, tierId: number, snapshot: CartItemSnapshot) {
      const key = ticketKey(ticketTypeId, tierId)
      const existing = this.items.find(i => itemKey(i) === key)
      if (existing) {
        existing.quantity += 1
      } else {
        this.items.push({
          type: 'ticket',
          shop_item_id: null,
          variant_id: null,
          ticket_type_id: ticketTypeId,
          ticket_price_tier_id: tierId,
          quantity: 1,
          snapshot,
        })
      }
      this._persist()
    },

    removeTicket(ticketTypeId: number, tierId: number) {
      const key = ticketKey(ticketTypeId, tierId)
      this.items = this.items.filter(i => itemKey(i) !== key)
      this._persist()
    },

    updateTicketQuantity(ticketTypeId: number, tierId: number, quantity: number) {
      if (quantity < 1) { this.removeTicket(ticketTypeId, tierId); return }
      const key = ticketKey(ticketTypeId, tierId)
      const item = this.items.find(i => itemKey(i) === key)
      if (item) { item.quantity = quantity; this._persist() }
    },

    // ── Generic key-based (used by CartSummary) ──────────────────────────

    removeByKey(key: string) {
      this.items = this.items.filter(i => itemKey(i) !== key)
      this._persist()
    },

    updateQuantityByKey(key: string, quantity: number) {
      if (quantity < 1) { this.removeByKey(key); return }
      const item = this.items.find(i => itemKey(i) === key)
      if (item) { item.quantity = quantity; this._persist() }
    },

    // ── Common ────────────────────────────────────────────────────────────

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
