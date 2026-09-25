/**
 * Non-ok responses go through handleResponse(), like the rest of src/api.
 * The hardcoded English here used to beat the caller's translated fallback in
 * saveErrorMessage, which returns error.message first.
 */
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from '@/api/client'
import type { NewsletterSubscriber } from '@/types/newsletterSubscriber'

interface SubscriberPage {
  data: NewsletterSubscriber[]
  meta: { current_page: number; last_page: number; total: number }
}

export async function subscribeToNewsletter(payload: {
  email: string
  name?: string
  source?: string
  website?: string
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  return handleResponse<void>(res)
}

export async function confirmNewsletterSubscription(token: string): Promise<void> {
  if (!token || typeof token !== 'string') throw new Error('Invalid token.')
  const res = await fetch(`${API_BASE}/api/newsletter/confirm/${encodeURIComponent(token)}`)
  return handleResponse<void>(res)
}

export async function unsubscribeFromNewsletter(token: string): Promise<void> {
  if (!token || typeof token !== 'string') throw new Error('Invalid token.')
  const res = await fetch(`${API_BASE}/api/newsletter/unsubscribe/${encodeURIComponent(token)}`)
  return handleResponse<void>(res)
}

export async function fetchNewsletterSubscribers(token: string, page = 1): Promise<SubscriberPage> {
  const res = await fetch(`${API_BASE}/api/newsletter-subscribers?page=${page}`, {
    headers: authHeaders(token),
  })
  return handleResponse<SubscriberPage>(res)
}

export async function deleteNewsletterSubscriber(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/newsletter-subscribers/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
