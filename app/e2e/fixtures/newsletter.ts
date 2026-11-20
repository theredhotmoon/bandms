import { expect, type APIRequestContext } from '@playwright/test'
import { adminHeaders } from './admin-api'

/**
 * Newsletter fixtures for admin specs.
 *
 * Seeding goes through the public sign-up, the only way to create a
 * subscriber. That route is `throttle:5,1` per address, and every spec runs
 * from 127.0.0.1, so parallel specs can share one minute's budget: a 429 is
 * waited out per its Retry-After rather than failing as a "flaky" spec.
 */
export function uniqueSubscriberEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

export async function seedSubscriber(
  request: APIRequestContext,
  email: string,
  extra: { name?: string } = {},
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await request.post('/api/newsletter/subscribe', { data: { email, source: 'e2e', ...extra } })
    if (res.status() === 429) {
      const wait = Number(res.headers()['retry-after'] ?? '60')
      await new Promise(r => setTimeout(r, (Number.isFinite(wait) ? wait : 60) * 1000 + 250))
      continue
    }
    expect(res.status(), await res.text()).toBe(201)
    return
  }
  throw new Error(`seedSubscriber: still throttled after 3 attempts for ${email}`)
}

/** Walks every page — a fixture is not guaranteed to be on page 1. */
export async function findSubscriberId(request: APIRequestContext, email: string): Promise<number | null> {
  for (let page = 1; page <= 50; page++) {
    const res = await request.get(`/api/newsletter-subscribers?page=${page}`, { headers: adminHeaders() })
    expect(res.ok(), `list subscribers: ${res.status()}`).toBe(true)
    const body = await res.json() as { data: { id: number; email: string }[]; meta: { last_page: number } }
    const hit = body.data.find(s => s.email === email)
    if (hit) return hit.id
    if (page >= body.meta.last_page) return null
  }
  return null
}

export async function removeSubscriber(request: APIRequestContext, email: string): Promise<void> {
  const id = await findSubscriberId(request, email)
  if (id === null) return
  const res = await request.delete(`/api/newsletter-subscribers/${id}`, { headers: adminHeaders() })
  expect(res.status()).toBe(204)
}
