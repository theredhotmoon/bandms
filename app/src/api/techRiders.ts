import type { TechRider, TechRiderSummary, TechRiderPayload } from '@/types/techRider'
import type { PublishedRider } from '@/types/techRiderVersion'
import { API_BASE, authHeaders, handleResponse } from './client'

interface ListResponse    { data: TechRiderSummary[] }
interface SingleResponse  { data: TechRider }
interface PublishedResponse { data: PublishedRider }

export async function fetchActiveTechRider(): Promise<TechRider> {
  const res = await fetch(`${API_BASE}/api/tech-riders/active`)
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function fetchTechRiders(): Promise<TechRiderSummary[]> {
  const res = await fetch(`${API_BASE}/api/tech-riders`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
  })
  return handleResponse<ListResponse>(res).then((r) => r.data)
}

export async function fetchTechRider(id: number): Promise<TechRider> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid tech rider id')
  const res = await fetch(`${API_BASE}/api/tech-riders/${id}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function createTechRider(token: string, payload: TechRiderPayload): Promise<TechRider> {
  const res = await fetch(`${API_BASE}/api/tech-riders`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function updateTechRider(
  token: string,
  id: number,
  payload: TechRiderPayload,
): Promise<TechRider> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid tech rider id')
  const res = await fetch(`${API_BASE}/api/tech-riders/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function activateTechRider(token: string, id: number): Promise<TechRider> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid tech rider id')
  const res = await fetch(`${API_BASE}/api/tech-riders/${id}/activate`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

/**
 * The public rider link. Returns a *published version*, never the live rider —
 * the sheet a promoter holds must not change under them when a musician edits
 * their saved rig. The snapshot carries the members and band identity as well,
 * so this page needs no further requests and no live data at all.
 *
 * The token is either the rider's own (follows the band forward to whichever
 * version is published) or a version's (that exact version, permanently).
 */
export async function fetchPublishedRider(token: string): Promise<PublishedRider> {
  if (!token || !/^[A-Za-z0-9]{16,64}$/.test(token)) throw new Error('Invalid rider token')
  const res = await fetch(`${API_BASE}/api/public/rider/${encodeURIComponent(token)}`)
  return handleResponse<PublishedResponse>(res).then((r) => r.data)
}

export async function deleteTechRider(token: string, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid tech rider id')
  const res = await fetch(`${API_BASE}/api/tech-riders/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok && res.status !== 204) await handleResponse(res)
}
