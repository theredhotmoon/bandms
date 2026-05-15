import type { EpkVersion, EpkVersionPayload } from '@/types/epkVersion'
import { API_BASE, assertSafeId, authHeaders, handleResponse } from './client'

interface EpkVersionListResponse { data: EpkVersion[] }
interface EpkVersionResponse    { data: EpkVersion }

export async function fetchEpkVersions(token: string): Promise<EpkVersion[]> {
  const res = await fetch(`${API_BASE}/api/epk-versions`, { headers: authHeaders(token) })
  return handleResponse<EpkVersionListResponse>(res).then((r) => r.data)
}

export async function createEpkVersion(token: string, payload: EpkVersionPayload): Promise<EpkVersion> {
  const res = await fetch(`${API_BASE}/api/epk-versions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<EpkVersionResponse>(res).then((r) => r.data)
}

export async function publishEpkVersion(token: string, id: number): Promise<EpkVersion> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/epk-versions/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<EpkVersionResponse>(res).then((r) => r.data)
}

export async function discardEpkVersion(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/epk-versions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
