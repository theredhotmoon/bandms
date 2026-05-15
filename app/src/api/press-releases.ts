import type { PressRelease, PressReleaseMeta, PressReleasePayload, PressReleaseSummary } from '@/types/press-release'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface PressReleaseListResponse { data: PressReleaseSummary[] }
interface PressReleaseResponse     { data: PressRelease }
interface MetaResponse             { data: PressReleaseMeta }

export async function fetchPressReleases(): Promise<PressReleaseSummary[]> {
  const res = await fetch(`${API_BASE}/api/press-releases`, { headers: jsonHeaders })
  return handleResponse<PressReleaseListResponse>(res).then((r) => r.data)
}

export async function fetchPressRelease(id: number): Promise<PressRelease> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/press-releases/${id}`, { headers: jsonHeaders })
  return handleResponse<PressReleaseResponse>(res).then((r) => r.data)
}

export async function fetchMetaForUrl(token: string, url: string): Promise<PressReleaseMeta> {
  const res = await fetch(`${API_BASE}/api/press-releases/fetch-meta`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ url }),
  })
  return handleResponse<MetaResponse>(res).then((r) => r.data)
}

export async function createPressRelease(token: string, payload: PressReleasePayload): Promise<PressRelease> {
  const res = await fetch(`${API_BASE}/api/press-releases`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<PressReleaseResponse>(res).then((r) => r.data)
}

export async function updatePressRelease(token: string, id: number, payload: PressReleasePayload): Promise<PressRelease> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/press-releases/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<PressReleaseResponse>(res).then((r) => r.data)
}

export async function deletePressRelease(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/press-releases/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
