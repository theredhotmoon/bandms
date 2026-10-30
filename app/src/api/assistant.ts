import type { AssistantCapabilities, TranslateItem } from '@/types/assistant'
import { API_BASE, authHeaders, handleResponse } from './client'

interface CapabilitiesResponse {
  data: AssistantCapabilities
}

interface TranslateResponse {
  data: { items: { key: string; text: string }[]; provider: string }
}

export async function fetchAssistantCapabilities(token: string): Promise<AssistantCapabilities> {
  const res = await fetch(`${API_BASE}/api/admin/assistant/capabilities`, { headers: authHeaders(token) })
  const body = await handleResponse<CapabilitiesResponse>(res)
  return { translate: body.data?.translate === true, rewrite: body.data?.rewrite === true }
}

/**
 * All-or-nothing for the items given; a 503 arrives as an ApiError carrying
 * the server's toast message (quota reached, key rejected, not configured).
 */
export async function translateItems(
  token: string,
  items: TranslateItem[],
): Promise<{ items: Record<string, string>; provider: string }> {
  const res = await fetch(`${API_BASE}/api/admin/assistant/translate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ items }),
  })
  const body = await handleResponse<TranslateResponse>(res)
  return {
    items: Object.fromEntries(body.data.items.map(i => [i.key, i.text])),
    provider: body.data.provider,
  }
}
