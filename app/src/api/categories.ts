import type { Category, CategoryPayload } from '@/types/category'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface CategoryListResponse { data: Category[] }
interface CategoryResponse { data: Category }

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/api/categories`, { headers: jsonHeaders })
  return handleResponse<CategoryListResponse>(res).then((r) => r.data)
}

export async function createCategory(token: string, payload: CategoryPayload): Promise<Category> {
  const res = await fetch(`${API_BASE}/api/categories`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<CategoryResponse>(res).then((r) => r.data)
}

export async function updateCategory(token: string, id: number, payload: CategoryPayload): Promise<Category> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/categories/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<CategoryResponse>(res).then((r) => r.data)
}

export async function deleteCategory(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
