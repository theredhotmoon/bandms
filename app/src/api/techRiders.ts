import type { TechRider, TechRiderSummary, TechRiderPayload } from '@/types/techRider'
import { API_BASE, authHeaders, handleResponse } from './client'

interface ListResponse    { data: TechRiderSummary[] }
interface SingleResponse  { data: TechRider }

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

export async function deleteTechRider(token: string, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid tech rider id')
  const res = await fetch(`${API_BASE}/api/tech-riders/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok && res.status !== 204) await handleResponse(res)
}
