import { API_BASE, assertSafeId, authHeaders, jsonHeaders } from '@/api/client'
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Failed to subscribe.')
  }
}

export async function confirmNewsletterSubscription(token: string): Promise<void> {
  if (!token || typeof token !== 'string') throw new Error('Invalid token.')
  const res = await fetch(`${API_BASE}/api/newsletter/confirm/${encodeURIComponent(token)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Confirmation failed.')
  }
}

export async function unsubscribeFromNewsletter(token: string): Promise<void> {
  if (!token || typeof token !== 'string') throw new Error('Invalid token.')
  const res = await fetch(`${API_BASE}/api/newsletter/unsubscribe/${encodeURIComponent(token)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Unsubscribe failed.')
  }
}

export async function fetchNewsletterSubscribers(token: string, page = 1): Promise<SubscriberPage> {
  const res = await fetch(`${API_BASE}/api/newsletter-subscribers?page=${page}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to fetch subscribers.')
  return res.json() as Promise<SubscriberPage>
}

export async function deleteNewsletterSubscriber(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/newsletter-subscribers/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to remove subscriber.')
}
