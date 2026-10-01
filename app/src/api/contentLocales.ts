import type { Lang } from '@/locales'
import { normaliseContentOrder } from '@/utils/contentLocales'
import { API_BASE, authHeaders, handleResponse } from './client'

interface ContentLocalesResponse {
  data: { order: unknown }
}

export async function fetchContentLocaleOrder(token: string): Promise<Lang[]> {
  const res = await fetch(`${API_BASE}/api/admin/content-locales`, { headers: authHeaders(token) })
  const body = await handleResponse<ContentLocalesResponse>(res)
  return normaliseContentOrder(body.data?.order)
}

export async function updateContentLocaleOrder(token: string, order: Lang[]): Promise<Lang[]> {
  const res = await fetch(`${API_BASE}/api/admin/content-locales`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ order }),
  })
  const body = await handleResponse<ContentLocalesResponse>(res)
  return normaliseContentOrder(body.data?.order)
}
