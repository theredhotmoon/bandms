import type {
  PublishedRider,
  TechRiderVersion,
  TechRiderVersionPayload,
} from '@bandms/rider-core'
import { API_BASE, assertSafeId, authHeaders, handleResponse } from './client'

interface ListResponse   { data: TechRiderVersion[] }
interface SingleResponse { data: TechRiderVersion }
interface SnapshotResponse { data: PublishedRider }

export async function fetchTechRiderVersions(
  token: string,
  riderId: number,
): Promise<TechRiderVersion[]> {
  assertSafeId(riderId)
  const res = await fetch(`${API_BASE}/api/tech-riders/${riderId}/versions`, {
    headers: authHeaders(token),
  })
  return handleResponse<ListResponse>(res).then((r) => r.data)
}

/**
 * One version with its snapshot — what the list omits because it is large.
 * Comparing two versions resolves both here, with the same resolver that
 * renders them, rather than asking the server for a diff it cannot compute
 * without a second copy of the derivation rules.
 */
export async function fetchTechRiderVersion(token: string, id: number): Promise<PublishedRider> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/tech-rider-versions/${id}`, {
    headers: authHeaders(token),
  })
  return handleResponse<SnapshotResponse>(res).then((r) => r.data)
}

/** Freezes the rider as it stands and points its public link at the new copy. */
export async function publishTechRiderVersion(
  token: string,
  riderId: number,
  payload: TechRiderVersionPayload = {},
): Promise<TechRiderVersion> {
  assertSafeId(riderId)
  const res = await fetch(`${API_BASE}/api/tech-riders/${riderId}/versions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

/** Only archived versions can go — the published one is what a venue holds. */
export async function deleteTechRiderVersion(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/tech-rider-versions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok && res.status !== 204) await handleResponse(res)
}
