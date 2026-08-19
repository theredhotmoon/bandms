import type {
  ConfirmationRequestResult,
  RiderConfirmation,
} from '@/types/riderConfirmation'
import { API_BASE, assertSafeId, authHeaders, handleResponse } from './client'

interface ListResponse   { data: RiderConfirmation[] }
interface SingleResponse { data: RiderConfirmation }

export async function fetchRiderConfirmations(
  token: string,
  riderId: number,
): Promise<RiderConfirmation[]> {
  assertSafeId(riderId)
  const res = await fetch(`${API_BASE}/api/tech-riders/${riderId}/confirmations`, {
    headers: authHeaders(token),
  })
  return handleResponse<ListResponse>(res).then((r) => r.data)
}

/** Mails everyone in tonight's lineup who can sign in. */
export async function requestRiderConfirmations(
  token: string,
  riderId: number,
): Promise<ConfirmationRequestResult> {
  assertSafeId(riderId)
  const res = await fetch(`${API_BASE}/api/tech-riders/${riderId}/confirmations`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<ConfirmationRequestResult>(res)
}

/** Riders waiting on the signed-in musician. */
export async function fetchMyRiderConfirmations(token: string): Promise<RiderConfirmation[]> {
  const res = await fetch(`${API_BASE}/api/my-rider-confirmations`, {
    headers: authHeaders(token),
  })
  return handleResponse<ListResponse>(res).then((r) => r.data)
}

/** Confirms the caller's own rig — the endpoint takes no member id by design. */
export async function confirmMyRig(token: string, riderId: number): Promise<RiderConfirmation> {
  assertSafeId(riderId)
  const res = await fetch(`${API_BASE}/api/tech-riders/${riderId}/confirm`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}
