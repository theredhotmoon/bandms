import type { BandMember, BandMemberPayload } from '@/types/bandMember'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface BandMemberListResponse { data: BandMember[] }
interface BandMemberResponse { data: BandMember }

export async function fetchBandMembers(): Promise<BandMember[]> {
  const res = await fetch(`${API_BASE}/api/band-profile/members`, { headers: jsonHeaders })
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
