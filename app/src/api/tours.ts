import type { Tour, TourSummary, TourPayload } from '@/types/tour'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface TourListResponse { data: TourSummary[] }
interface TourResponse    { data: Tour }

export async function fetchTours(): Promise<TourSummary[]> {
  const res = await fetch(`${API_BASE}/api/tours`, { headers: jsonHeaders })
  return handleResponse<TourListResponse>(res).then((r) => r.data)
}

export async function fetchTour(id: number): Promise<Tour> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/tours/${id}`, { headers: jsonHeaders })
  return handleResponse<TourResponse>(res).then((r) => r.data)
}

export async function createTour(token: string, payload: TourPayload): Promise<Tour> {
  const res = await fetch(`${API_BASE}/api/tours`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<TourResponse>(res).then((r) => r.data)
}

export async function updateTour(token: string, id: number, payload: TourPayload): Promise<Tour> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/tours/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<TourResponse>(res).then((r) => r.data)
}

export async function deleteTour(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/tours/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
