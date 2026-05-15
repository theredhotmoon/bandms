import type { Photo, PhotoPayload } from '@/types/photo'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface PhotoListResponse { data: Photo[] }
interface PhotoResponse { data: Photo }

export async function fetchPhotos(): Promise<Photo[]> {
  const res = await fetch(`${API_BASE}/api/photos`, { headers: jsonHeaders })
  return handleResponse<PhotoListResponse>(res).then((r) => r.data)
}

export async function fetchPhoto(id: number): Promise<Photo> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/photos/${id}`, { headers: jsonHeaders })
  return handleResponse<PhotoResponse>(res).then((r) => r.data)
}

export async function updatePhoto(token: string, id: number, payload: PhotoPayload): Promise<Photo> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/photos/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<PhotoResponse>(res).then((r) => r.data)
}

export async function togglePhotoEpkFeatured(token: string, id: number, epk_featured: boolean): Promise<void> {
  assertSafeId(id)
  await fetch(`${API_BASE}/api/photos/${id}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ epk_featured }),
  })
}

export async function deletePhoto(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/photos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
