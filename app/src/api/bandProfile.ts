import type { BandProfile, BandProfilePayload, EpkData, FacebookSyncResult } from '@/types/bandProfile'
import { API_BASE, authHeaders, handleResponse, jsonHeaders } from './client'

interface BandProfileResponse { data: BandProfile }
interface EpkResponse { data: EpkData }

export async function fetchBandProfile(): Promise<BandProfile> {
  const res = await fetch(`${API_BASE}/api/band-profile`, { headers: jsonHeaders })
  return handleResponse<BandProfileResponse>(res).then((r) => r.data)
}

export async function fetchEpk(): Promise<EpkData> {
  const res = await fetch(`${API_BASE}/api/band-profile/epk`, { headers: jsonHeaders })
  return handleResponse<EpkResponse>(res).then((r) => r.data)
}

export async function updateBandProfile(token: string, payload: BandProfilePayload): Promise<BandProfile> {
  const res = await fetch(`${API_BASE}/api/band-profile`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<BandProfileResponse>(res).then((r) => r.data)
}

export async function uploadTechRider(token: string, file: File): Promise<BandProfile> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${API_BASE}/api/band-profile/tech-rider`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<BandProfileResponse>(res).then((r) => r.data)
}

export async function deleteTechRider(token: string): Promise<BandProfile> {
  const res = await fetch(`${API_BASE}/api/band-profile/tech-rider`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<BandProfileResponse>(res).then((r) => r.data)
}

export async function uploadStagePlot(token: string, file: File): Promise<BandProfile> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${API_BASE}/api/band-profile/stage-plot`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<BandProfileResponse>(res).then((r) => r.data)
}

export async function deleteStagePlot(token: string): Promise<BandProfile> {
  const res = await fetch(`${API_BASE}/api/band-profile/stage-plot`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<BandProfileResponse>(res).then((r) => r.data)
}

export async function syncFacebookLikes(token: string): Promise<FacebookSyncResult> {
  const res = await fetch(`${API_BASE}/api/band-profile/sync-facebook-likes`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Failed to sync Facebook likes')
  }
  return res.json() as Promise<FacebookSyncResult>
}
