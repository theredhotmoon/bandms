import type { HeroImagesResponse } from '@/types/heroImage'
import { API_BASE, authHeaders, handleResponse } from './client'

export async function fetchHeroImages(token: string): Promise<HeroImagesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/hero-images`, { headers: authHeaders(token) })
  return handleResponse<HeroImagesResponse>(res)
}

/**
 * Replace one scope's set. The payload order is the display order — the server
 * writes `position` from the array index.
 *
 * The scope is path-encoded because it is a slug from the API, not free text;
 * encodeURIComponent keeps a hyphenated slug like 'tech-rider' intact and
 * refuses to let anything odder through as a path segment.
 */
export async function saveHeroImageScope(
  token: string,
  scope: string,
  photoIds: number[],
): Promise<HeroImagesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/hero-images/${encodeURIComponent(scope)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ photo_ids: photoIds }),
  })
  return handleResponse<HeroImagesResponse>(res)
}
