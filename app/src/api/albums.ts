import type { Album, AlbumPayload, BatchAlbumUploadMeta } from '@/types/album'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface AlbumListResponse { data: Album[] }
interface AlbumResponse { data: Album }

export async function fetchAlbums(): Promise<Album[]> {
  const res = await fetch(`${API_BASE}/api/albums`, { headers: jsonHeaders })
  return handleResponse<AlbumListResponse>(res).then((r) => r.data)
}

export async function fetchAlbum(id: number): Promise<Album> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/albums/${id}`, { headers: jsonHeaders })
  return handleResponse<AlbumResponse>(res).then((r) => r.data)
}

export async function updateAlbum(token: string, id: number, payload: Partial<AlbumPayload>): Promise<Album> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/albums/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<AlbumResponse>(res).then((r) => r.data)
}

export async function deleteAlbum(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/albums/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function reorderAlbumPhotos(token: string, albumId: number, order: number[]): Promise<Album> {
  assertSafeId(albumId)
  const res = await fetch(`${API_BASE}/api/albums/${albumId}/photos/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ order }),
  })
  return handleResponse<AlbumResponse>(res).then((r) => r.data)
}

export async function removeAlbumPhoto(token: string, albumId: number, photoId: number): Promise<void> {
  assertSafeId(albumId)
  assertSafeId(photoId)
  const res = await fetch(`${API_BASE}/api/albums/${albumId}/photos/${photoId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export function batchCreateAlbum(
  token: string,
  files: { file: File; caption: string }[],
  meta: BatchAlbumUploadMeta,
  onProgress: (p: UploadProgress) => void,
): Promise<Album> {
  return new Promise((resolve, reject) => {
    const body = new FormData()
    body.append('title', meta.title)
    if (meta.description)    body.append('description', meta.description)
    if (meta.venue_id != null)   body.append('venue_id', String(meta.venue_id))
    if (meta.concert_id != null) body.append('concert_id', String(meta.concert_id))
    if (meta.taken_at)       body.append('taken_at', meta.taken_at)
    if (meta.published_at)   body.append('published_at', meta.published_at)
    meta.tag_ids?.forEach((id) => body.append('tag_ids[]', String(id)))

    files.forEach(({ file, caption }) => {
      body.append('files[]', file)
      body.append('captions[]', caption)
    })

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/albums/batch`)
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
          const json = JSON.parse(xhr.responseText)
          resolve(json.data as Album)
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
