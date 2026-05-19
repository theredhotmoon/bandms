import type { Concert, ConcertPayload } from '@/types/concert'
import type { PublicSetlist } from '@/types/setlist'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface ConcertListResponse {
  data: Concert[]
}

interface ConcertResponse {
  data: Concert
}

export async function fetchConcerts(): Promise<Concert[]> {
  const res = await fetch(`${API_BASE}/api/concerts`, { headers: jsonHeaders })
  return handleResponse<ConcertListResponse>(res).then((r) => r.data)
}

export async function fetchConcert(id: number): Promise<Concert> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/concerts/${id}`, { headers: jsonHeaders })
  return handleResponse<ConcertResponse>(res).then((r) => r.data)
}

export async function createConcert(token: string, payload: ConcertPayload): Promise<Concert> {
  const res = await fetch(`${API_BASE}/api/concerts`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ConcertResponse>(res).then((r) => r.data)
}

export async function updateConcert(
  token: string,
  id: number,
  payload: Partial<ConcertPayload>,
): Promise<Concert> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/concerts/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ConcertResponse>(res).then((r) => r.data)
}

export async function deleteConcert(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/concerts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function uploadConcertPoster(token: string, id: number, file: File): Promise<Concert> {
  assertSafeId(id)
  const body = new FormData()
  body.append('poster', file)
  const res = await fetch(`${API_BASE}/api/concerts/${id}/poster`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<ConcertResponse>(res).then((r) => r.data)
}

export async function deleteConcertPoster(token: string, id: number): Promise<Concert> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/concerts/${id}/poster`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<ConcertResponse>(res).then((r) => r.data)
}

export async function fetchConcertSetlist(id: number): Promise<PublicSetlist | null> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/concerts/${id}/setlist`, { headers: jsonHeaders })
  if (res.status === 404) return null
  return handleResponse<{ data: PublicSetlist }>(res).then((r) => r.data)
}
