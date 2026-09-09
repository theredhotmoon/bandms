import type { HeroImagesResponse } from '@/types/heroImage'
import { API_BASE, assertSafeId, authHeaders, handleResponse } from './client'

export async function fetchHeroImages(token: string): Promise<HeroImagesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/hero-images`, { headers: authHeaders(token) })
  return handleResponse<HeroImagesResponse>(res)
}

/**
 * Upload one or more new hero pictures into a scope, appended after whatever
 * is already there.
 *
 * Multipart, so it cannot go through authHeaders (that sets
 * Content-Type: application/json, which would break the multipart boundary) —
 * Authorization and Accept only, the same way batchCreateAlbum builds its
 * request. The scope is path-encoded because it is a slug from the API, not
 * free text.
 */
export async function uploadHeroImages(
  token: string,
  scope: string,
  files: { file: File; caption: string }[],
): Promise<HeroImagesResponse> {
  const body = new FormData()
  files.forEach(({ file, caption }) => {
    body.append('files[]', file)
    body.append('captions[]', caption)
  })

  const res = await fetch(`${API_BASE}/api/admin/hero-images/${encodeURIComponent(scope)}`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<HeroImagesResponse>(res)
}

/** Partial update — caption and/or active — for one hero image row. */
export async function updateHeroImage(
  token: string,
  id: number,
  payload: { caption?: string | null; active?: boolean },
): Promise<HeroImagesResponse> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/hero-images/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<HeroImagesResponse>(res)
}

/**
 * Reorder every row in one scope. `order` is the full list of that scope's
 * ids in the desired position order — the server writes `position` from the
 * array index.
 */
export async function reorderHeroImages(
  token: string,
  scope: string,
  order: number[],
): Promise<HeroImagesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/hero-images/${encodeURIComponent(scope)}/order`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ order }),
  })
  return handleResponse<HeroImagesResponse>(res)
}

export async function deleteHeroImage(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/hero-images/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
