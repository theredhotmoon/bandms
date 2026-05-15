import type {
  BandMemberSetup,
  BandMemberSetupSummary,
  BandMemberSetupPayload,
  MemberSetupGroup,
} from '@/types/bandMemberSetup'
import { API_BASE, authHeaders, handleResponse } from './client'

interface SummaryListResponse { data: BandMemberSetupSummary[] }
interface SingleResponse      { data: BandMemberSetup }
interface AllSetupsResponse   { data: MemberSetupGroup[] }

function assertMemberId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid member id')
}
function assertSetupId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid setup id')
}

export async function fetchMemberSetups(memberId: number): Promise<BandMemberSetupSummary[]> {
  assertMemberId(memberId)
  const res = await fetch(`${API_BASE}/api/band-profile/members/${memberId}/setups`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
  })
  return handleResponse<SummaryListResponse>(res).then((r) => r.data)
}

export async function fetchMemberSetup(memberId: number, setupId: number): Promise<BandMemberSetup> {
  assertMemberId(memberId)
  assertSetupId(setupId)
  const res = await fetch(
    `${API_BASE}/api/band-profile/members/${memberId}/setups/${setupId}`,
    { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` } },
  )
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function createMemberSetup(
  token: string,
  memberId: number,
  payload: BandMemberSetupPayload,
): Promise<BandMemberSetup> {
  assertMemberId(memberId)
  const res = await fetch(`${API_BASE}/api/band-profile/members/${memberId}/setups`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function updateMemberSetup(
  token: string,
  memberId: number,
  setupId: number,
  payload: BandMemberSetupPayload,
): Promise<BandMemberSetup> {
  assertMemberId(memberId)
  assertSetupId(setupId)
  const res = await fetch(
    `${API_BASE}/api/band-profile/members/${memberId}/setups/${setupId}`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  )
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function deleteMemberSetup(
  token: string,
  memberId: number,
  setupId: number,
): Promise<void> {
  assertMemberId(memberId)
  assertSetupId(setupId)
  const res = await fetch(
    `${API_BASE}/api/band-profile/members/${memberId}/setups/${setupId}`,
    { method: 'DELETE', headers: authHeaders(token) },
  )
  if (!res.ok && res.status !== 204) await handleResponse(res)
}

/** Bulk: all setups for all members — used by tech-rider import panel. */
export async function fetchAllMemberSetups(): Promise<MemberSetupGroup[]> {
  const res = await fetch(`${API_BASE}/api/band-profile/member-setups`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
  })
  return handleResponse<AllSetupsResponse>(res).then((r) => r.data)
}
