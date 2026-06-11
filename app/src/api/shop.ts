import type { ShopItem, ShopItemSummary, ShopItemPayload } from '@/types/shop'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface ListResponse<T> { data: T[] }
interface ItemResponse<T> { data: T }

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
