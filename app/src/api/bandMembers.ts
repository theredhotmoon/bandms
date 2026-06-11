import type { BandMember, BandMemberPayload } from '@/types/bandMember'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface BandMemberListResponse { data: BandMember[] }
interface BandMemberResponse { data: BandMember }

export async function fetchBandMembers(token?: string | null): Promise<BandMember[]> {
  const headers = token ? authHeaders(token) : jsonHeaders
  const res = await fetch(`${API_BASE}/api/band-profile/members`, { headers })
  return handleResponse<BandMemberListResponse>(res).then((r) => r.data)
}

export async function createBandMember(token: string, payload: BandMemberPayload): Promise<BandMember> {
  const res = await fetch(`${API_BASE}/api/band-profile/members`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<BandMemberResponse>(res).then((r) => r.data)
}

export async function updateBandMember(
  token: string,
  memberId: number,
  payload: Partial<BandMemberPayload>,
): Promise<BandMember> {
  assertSafeId(memberId)
  const res = await fetch(`${API_BASE}/api/band-profile/members/${memberId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<BandMemberResponse>(res).then((r) => r.data)
}

export async function deleteBandMember(token: string, memberId: number): Promise<void> {
  assertSafeId(memberId)
  const res = await fetch(`${API_BASE}/api/band-profile/members/${memberId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function uploadMemberPhoto(token: string, memberId: number, file: File): Promise<BandMember> {
  assertSafeId(memberId)
  const body = new FormData()
  body.append('photo', file)
  const res = await fetch(`${API_BASE}/api/band-profile/members/${memberId}/photo`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<BandMemberResponse>(res).then((r) => r.data)
}

export async function reorderBandMembers(token: string, ids: number[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/band-profile/members/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  })
  return handleResponse<void>(res)
}
