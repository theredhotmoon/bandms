import type { Faq, FaqPayload, FaqsResponse } from '@/types/faq'
import { API_BASE, authHeaders, handleResponse, assertSafeId } from './client'

export async function fetchFaqs(token: string): Promise<FaqsResponse> {
  const res = await fetch(`${API_BASE}/api/admin/faqs`, { headers: authHeaders(token) })
  return handleResponse<FaqsResponse>(res)
}

export async function createFaq(token: string, payload: FaqPayload): Promise<{ data: Faq }> {
  const res = await fetch(`${API_BASE}/api/admin/faqs`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<{ data: Faq }>(res)
}

export async function updateFaq(token: string, id: number, payload: FaqPayload): Promise<{ data: Faq }> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/faqs/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<{ data: Faq }>(res)
}

export async function deleteFaq(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/faqs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) await handleResponse<unknown>(res)
}

/** Reorder is scoped to one module so sorting one page cannot renumber another. */
export async function reorderFaqs(token: string, moduleSlug: string, ids: number[]): Promise<FaqsResponse> {
  const res = await fetch(`${API_BASE}/api/admin/faqs/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ module_slug: moduleSlug, ids }),
  })
  return handleResponse<FaqsResponse>(res)
}
