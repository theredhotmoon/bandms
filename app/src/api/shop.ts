import type { ShopItem, ShopItemSummary, ShopItemPayload, ShopCategory, ShopItemVariant } from '@/types/shop'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface ListResponse<T> { data: T[] }
interface ItemResponse<T> { data: T }

export interface ShopItemVariantPayload {
  name: string
  value: string
  stock_quantity: number | null
  sort_order?: number
}

// ── Public ───────────────────────────────────────────────────────────────────

export async function fetchShopItems(): Promise<ShopItemSummary[]> {
  const res = await fetch(`${API_BASE}/api/shop`, { headers: jsonHeaders })
  return handleResponse<ListResponse<ShopItemSummary>>(res).then(r => r.data)
}

export async function fetchShopItem(id: number): Promise<ShopItem> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/shop/${id}`, { headers: jsonHeaders })
  return handleResponse<ItemResponse<ShopItem>>(res).then(r => r.data)
}

export async function fetchShopItemBySlug(slug: string): Promise<ShopItem> {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid slug')
  const res = await fetch(`${API_BASE}/api/shop/by-slug/${slug}`, { headers: jsonHeaders })
  return handleResponse<ItemResponse<ShopItem>>(res).then(r => r.data)
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function fetchShopItemsAdmin(token: string): Promise<ShopItemSummary[]> {
  const res = await fetch(`${API_BASE}/api/shop-admin`, { headers: authHeaders(token) })
  return handleResponse<ListResponse<ShopItemSummary>>(res).then(r => r.data)
}

export async function createShopItem(token: string, payload: ShopItemPayload): Promise<ShopItem> {
  const res = await fetch(`${API_BASE}/api/shop`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ItemResponse<ShopItem>>(res).then(r => r.data)
}

export async function updateShopItem(token: string, id: number, payload: ShopItemPayload): Promise<ShopItem> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/shop/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ItemResponse<ShopItem>>(res).then(r => r.data)
}

export async function deleteShopItem(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/shop/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function uploadShopPhoto(token: string, itemId: number, file: File): Promise<{ id: number; url: string; alt_text: string | null; sort_order: number }> {
  assertSafeId(itemId)
  const body = new FormData()
  body.append('photo', file)
  const res = await fetch(`${API_BASE}/api/shop/${itemId}/photos`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse(res)
}

export async function deleteShopPhoto(token: string, itemId: number, photoId: number): Promise<void> {
  assertSafeId(itemId)
  assertSafeId(photoId)
  const res = await fetch(`${API_BASE}/api/shop/${itemId}/photos/${photoId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function reorderShopPhotos(token: string, itemId: number, ids: number[]): Promise<void> {
  assertSafeId(itemId)
  const res = await fetch(`${API_BASE}/api/shop/${itemId}/photos/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  })
  return handleResponse<void>(res)
}

export async function fetchShopCurrencies(token: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/shop-currencies`, { headers: authHeaders(token) })
  return handleResponse<{ currencies: string[] }>(res).then(r => r.currencies)
}

export async function updateShopCurrencies(token: string, currencies: string[]): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/shop-currencies`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ currencies }),
  })
  return handleResponse<{ currencies: string[] }>(res).then(r => r.currencies)
}

// ── Shop categories ──────────────────────────────────────────────────────────

export async function fetchShopCategories(): Promise<ShopCategory[]> {
  const res = await fetch(`${API_BASE}/api/shop-categories`, { headers: jsonHeaders })
  return handleResponse<ListResponse<ShopCategory>>(res).then(r => r.data)
}

export async function createShopCategory(token: string, payload: { name: string; description?: string | null; sort_order?: number }): Promise<ShopCategory> {
  const res = await fetch(`${API_BASE}/api/shop-categories`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ItemResponse<ShopCategory>>(res).then(r => r.data)
}

export async function updateShopCategory(token: string, id: number, payload: { name: string; description?: string | null; sort_order?: number }): Promise<ShopCategory> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/shop-categories/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ItemResponse<ShopCategory>>(res).then(r => r.data)
}

export async function deleteShopCategory(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/shop-categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

// ── Shop item variants (admin) ────────────────────────────────────────────────

export async function fetchShopVariants(token: string, itemId: number): Promise<ShopItemVariant[]> {
  assertSafeId(itemId)
  const res = await fetch(`${API_BASE}/api/shop/${itemId}/variants`, { headers: authHeaders(token) })
  return handleResponse<ListResponse<ShopItemVariant>>(res).then(r => r.data)
}

export async function createShopVariant(token: string, itemId: number, payload: ShopItemVariantPayload): Promise<ShopItemVariant> {
  assertSafeId(itemId)
  const res = await fetch(`${API_BASE}/api/shop/${itemId}/variants`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ItemResponse<ShopItemVariant>>(res).then(r => r.data)
}

export async function updateShopVariant(token: string, itemId: number, variantId: number, payload: ShopItemVariantPayload): Promise<ShopItemVariant> {
  assertSafeId(itemId)
  assertSafeId(variantId)
  const res = await fetch(`${API_BASE}/api/shop/${itemId}/variants/${variantId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ItemResponse<ShopItemVariant>>(res).then(r => r.data)
}

export async function deleteShopVariant(token: string, itemId: number, variantId: number): Promise<void> {
  assertSafeId(itemId)
  assertSafeId(variantId)
  const res = await fetch(`${API_BASE}/api/shop/${itemId}/variants/${variantId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export interface CheckoutPayload {
  currency: string
  customer: { name: string; email: string; shipping_address: { line1: string; line2?: string; city: string; postal_code: string; country: string } }
  items: { shop_item_id: number; shop_item_variant_id: number | null; quantity: number }[]
}

export async function createCheckoutSession(payload: CheckoutPayload): Promise<{ checkout_url: string; order_uuid: string }> {
  const res = await fetch(`${API_BASE}/api/checkout`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function fetchOrder(uuid: string): Promise<import('@/types/order').Order> {
  if (!uuid || !UUID_RE.test(uuid)) throw new Error('Invalid order UUID')
  const res = await fetch(`${API_BASE}/api/orders/${uuid}`, { headers: jsonHeaders })
  return handleResponse<ItemResponse<import('@/types/order').Order>>(res).then(r => r.data)
}
