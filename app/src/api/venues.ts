import type { Venue, VenuePayload } from '@/types/venue'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface VenueListResponse {
  data: Venue[]
}

interface VenueResponse {
  data: Venue
}

export async function fetchVenues(): Promise<Venue[]> {
  const res = await fetch(`${API_BASE}/api/venues`, { headers: jsonHeaders })
  return handleResponse<VenueListResponse>(res).then((r) => r.data)
}

export async function fetchVenue(id: number): Promise<Venue> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/venues/${id}`, { headers: jsonHeaders })
  return handleResponse<VenueResponse>(res).then((r) => r.data)
}

export async function createVenue(token: string, payload: VenuePayload): Promise<Venue> {
  const res = await fetch(`${API_BASE}/api/venues`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<VenueResponse>(res).then((r) => r.data)
}

export async function updateVenue(
  token: string,
  id: number,
  payload: Partial<VenuePayload>,
): Promise<Venue> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/venues/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<VenueResponse>(res).then((r) => r.data)
}

export async function deleteVenue(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/venues/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
