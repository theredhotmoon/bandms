import type { Release, ReleaseSummary, ReleasePayload } from '@/types/release'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'
import type { Lang } from '@/composables/useLang'

interface ReleaseListResponse { data: ReleaseSummary[] }
interface ReleaseResponse     { data: Release }

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export async function fetchReleases(lang: Lang = 'en'): Promise<ReleaseSummary[]> {
  const res = await fetch(`${API_BASE}/api/releases?lang=${lang}`, { headers: jsonHeaders })
  return handleResponse<ReleaseListResponse>(res).then((r) => r.data)
}

export async function fetchRelease(id: number, lang: Lang = 'en'): Promise<Release> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/releases/${id}?lang=${lang}`, { headers: jsonHeaders })
  return handleResponse<ReleaseResponse>(res).then((r) => r.data)
}

export async function createRelease(token: string, payload: ReleasePayload): Promise<Release> {
  const res = await fetch(`${API_BASE}/api/releases`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ReleaseResponse>(res).then((r) => r.data)
}

export async function updateRelease(token: string, id: number, payload: ReleasePayload): Promise<Release> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/releases/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ReleaseResponse>(res).then((r) => r.data)
}

export async function deleteRelease(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/releases/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function uploadReleaseCover(token: string, id: number, file: File): Promise<Release> {
  assertSafeId(id)
  const body = new FormData()
  body.append('cover', file)
  const res = await fetch(`${API_BASE}/api/releases/${id}/cover`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<ReleaseResponse>(res).then((r) => r.data)
}

export async function deleteReleaseCover(token: string, id: number): Promise<Release> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/releases/${id}/cover`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<ReleaseResponse>(res).then((r) => r.data)
}

export function addReleasePhotos(
  token: string,
  releaseId: number,
  files: { file: File; caption: string }[],
  onProgress: (p: UploadProgress) => void,
): Promise<Release> {
  assertSafeId(releaseId)
  return new Promise((resolve, reject) => {
    const body = new FormData()
    files.forEach(({ file, caption }) => {
      body.append('files[]', file)
      body.append('captions[]', caption)
    })

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/releases/${releaseId}/photos`)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve((JSON.parse(xhr.responseText) as ReleaseResponse).data)
        } catch {
          reject(new Error('Invalid JSON response'))
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(body)
  })
}

export async function removeReleasePhoto(token: string, releaseId: number, photoId: number): Promise<void> {
  assertSafeId(releaseId)
  assertSafeId(photoId)
  const res = await fetch(`${API_BASE}/api/releases/${releaseId}/photos/${photoId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function reorderReleasePhotos(token: string, releaseId: number, order: number[]): Promise<Release> {
  assertSafeId(releaseId)
  const res = await fetch(`${API_BASE}/api/releases/${releaseId}/photos/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ order }),
  })
  return handleResponse<ReleaseResponse>(res).then((r) => r.data)
}
