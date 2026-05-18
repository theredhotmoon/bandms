import type { Song, SongPayload } from '@/types/song'
import { API_BASE, authHeaders, handleResponse } from './client'

interface ListResponse   { data: Song[] }
interface SingleResponse { data: Song }

export async function fetchSongs(token: string): Promise<Song[]> {
  const res = await fetch(`${API_BASE}/api/songs`, { headers: authHeaders(token) })
  return handleResponse<ListResponse>(res).then((r) => r.data)
}

export async function createSong(token: string, payload: SongPayload): Promise<Song> {
  const res = await fetch(`${API_BASE}/api/songs`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function updateSong(token: string, id: number, payload: Partial<SongPayload>): Promise<Song> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid song id')
  const res = await fetch(`${API_BASE}/api/songs/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function deleteSong(token: string, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid song id')
  const res = await fetch(`${API_BASE}/api/songs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok && res.status !== 204) await handleResponse(res)
}
