import type { Clip, ClipAttach, ClipPayload } from '@/types/clip'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface ClipListResponse { data: Clip[] }
interface ClipResponse { data: Clip }

export async function fetchClips(): Promise<Clip[]> {
  const res = await fetch(`${API_BASE}/api/clips`, { headers: jsonHeaders })
  return handleResponse<ClipListResponse>(res).then(r => r.data)
}

export async function createClip(token: string, payload: ClipPayload): Promise<Clip> {
  const res = await fetch(`${API_BASE}/api/clips`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload) })
  return handleResponse<ClipResponse>(res).then(r => r.data)
}

export async function updateClip(token: string, id: number, payload: ClipPayload): Promise<Clip> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/clips/${id}`, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(payload) })
  return handleResponse<ClipResponse>(res).then(r => r.data)
}

export async function deleteClip(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/clips/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  await handleResponse<void>(res)
}

export async function attachClip(token: string, id: number, owner: ClipAttach): Promise<Clip> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/clips/${id}/attach`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(owner) })
  return handleResponse<ClipResponse>(res).then(r => r.data)
}

export async function detachClip(token: string, id: number, owner: ClipAttach): Promise<Clip> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/clips/${id}/attach`, { method: 'DELETE', headers: authHeaders(token), body: JSON.stringify(owner) })
  return handleResponse<ClipResponse>(res).then(r => r.data)
}
