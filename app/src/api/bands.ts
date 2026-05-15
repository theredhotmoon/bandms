import type { Band, BandPayload } from '@/types/band'
import { API_BASE, assertSafeId, authHeaders, handleResponse } from './client'

interface BandListResponse { data: Band[] }
interface BandResponse { data: Band }

export async function fetchBands(token: string): Promise<Band[]> {
  const res = await fetch(`${API_BASE}/api/bands`, { headers: authHeaders(token) })
  return handleResponse<BandListResponse>(res).then((r) => r.data)
}

export async function createBand(token: string, payload: BandPayload): Promise<Band> {
  const res = await fetch(`${API_BASE}/api/bands`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<BandResponse>(res).then((r) => r.data)
}

export async function updateBand(token: string, id: number, payload: BandPayload): Promise<Band> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/bands/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<BandResponse>(res).then((r) => r.data)
}

export async function deleteBand(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/bands/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
