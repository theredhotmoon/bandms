import { atom, map, computed } from 'nanostores'
import type { CartItem, ShopItemPrice } from '@/types/shop'

const STORAGE_KEY = 'bandms_cart'

export const cartOpen = atom(false)

function loadFromStorage(): CartItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as CartItem[]) : []
  } catch {
    return []
  }
}

export const cartItems = map<Record<string, CartItem>>({})

// Initialise from localStorage on first client load
if (typeof window !== 'undefined') {
  const saved = loadFromStorage()
  const initial: Record<string, CartItem> = {}
  for (const item of saved) {
    initial[cartKey(item.shopItemId, item.variantId)] = item
  }
  cartItems.set(initial)
}

function cartKey(shopItemId: number, variantId: number | null): string {
  return `${shopItemId}:${variantId ?? 'none'}`
}

function persist() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(cartItems.get())))
  }
}

export function addToCart(item: Omit<CartItem, 'quantity'>) {
  const key = cartKey(item.shopItemId, item.variantId)
  const current = cartItems.get()[key]
  cartItems.setKey(key, {
    ...item,
    quantity: (current?.quantity ?? 0) + 1,
  })
  persist()
}

export function removeFromCart(shopItemId: number, variantId: number | null) {
  const key = cartKey(shopItemId, variantId)
  const items = { ...cartItems.get() }
  delete items[key]
  cartItems.set(items)
  persist()
}

export function updateQuantity(shopItemId: number, variantId: number | null, qty: number) {
  const key = cartKey(shopItemId, variantId)
  if (qty <= 0) {
    removeFromCart(shopItemId, variantId)
    return
  }
  const current = cartItems.get()[key]
  if (!current) return
  cartItems.setKey(key, { ...current, quantity: qty })
  persist()
}

export function clearCart() {
  cartItems.set({})
  persist()
}

export const cartCount = computed(cartItems, (items) =>
  Object.values(items).reduce((sum, item) => sum + item.quantity, 0),
)

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price.amount * item.quantity, 0)
}

export function preferredPrice(prices: ShopItemPrice[]): ShopItemPrice | null {
  if (!prices.length) return null
  const pln = prices.find((p) => p.currency === 'PLN')
  const eur = prices.find((p) => p.currency === 'EUR')
  const usd = prices.find((p) => p.currency === 'USD')
  return pln ?? eur ?? usd ?? prices[0] ?? null
}

export function formatPrice(price: ShopItemPrice): string {
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: price.currency,
      minimumFractionDigits: 0,
    }).format(price.amount / 100)
  } catch {
    return `${(price.amount / 100).toFixed(2)} ${price.currency}`
  }
}
