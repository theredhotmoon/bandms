import type {
  Setlist, SetlistSummary, SetlistPayload,
  SetlistItem, SetlistItemPayload,
  SetlistFmArtist, SetlistFmSetlist,
} from '@/types/setlist'
import { API_BASE, authHeaders, handleResponse } from './client'

interface ListResponse    { data: SetlistSummary[] }
interface SingleResponse  { data: Setlist }
interface ItemResponse    { data: SetlistItem }

// ── Setlists ──────────────────────────────────────────────────────────────────

export async function fetchSetlists(token: string): Promise<SetlistSummary[]> {
  const res = await fetch(`${API_BASE}/api/setlists`, { headers: authHeaders(token) })
  return handleResponse<ListResponse>(res).then((r) => r.data)
}

export async function fetchSetlist(token: string, id: number): Promise<Setlist> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid setlist id')
  const res = await fetch(`${API_BASE}/api/setlists/${id}`, { headers: authHeaders(token) })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function createSetlist(token: string, payload: SetlistPayload): Promise<Setlist> {
  const res = await fetch(`${API_BASE}/api/setlists`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function updateSetlist(token: string, id: number, payload: SetlistPayload): Promise<Setlist> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid setlist id')
  const res = await fetch(`${API_BASE}/api/setlists/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function deleteSetlist(token: string, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid setlist id')
  const res = await fetch(`${API_BASE}/api/setlists/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok && res.status !== 204) await handleResponse(res)
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function addSetlistItem(
  token: string,
  setlistId: number,
  payload: SetlistItemPayload & { song_id: number },
): Promise<SetlistItem> {
  const res = await fetch(`${API_BASE}/api/setlists/${setlistId}/items`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ItemResponse>(res).then((r) => r.data)
}

export async function updateSetlistItem(
  token: string,
  setlistId: number,
  itemId: number,
  payload: SetlistItemPayload,
): Promise<SetlistItem> {
  const res = await fetch(`${API_BASE}/api/setlists/${setlistId}/items/${itemId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<ItemResponse>(res).then((r) => r.data)
}

export async function removeSetlistItem(token: string, setlistId: number, itemId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/setlists/${setlistId}/items/${itemId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok && res.status !== 204) await handleResponse(res)
}

export async function reorderSetlistItems(token: string, setlistId: number, order: number[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/setlists/${setlistId}/items/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ order }),
  })
  if (!res.ok) await handleResponse(res)
}

// ── Import ────────────────────────────────────────────────────────────────────

export async function importFromSetlistFm(
  token: string,
  payload: {
    setlistfm_id: string
    name: string
    event_date?: string | null
    songs: { title: string; is_encore: boolean }[]
  },
): Promise<Setlist> {
  const res = await fetch(`${API_BASE}/api/setlists/import-setlistfm`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

// ── setlist.fm proxy ──────────────────────────────────────────────────────────

export async function searchSetlistFmArtist(token: string, q: string): Promise<SetlistFmArtist[]> {
  const res = await fetch(
    `${API_BASE}/api/setlists/setlistfm/search?q=${encodeURIComponent(q)}`,
    { headers: authHeaders(token) },
  )
  const json = await handleResponse<{ data: SetlistFmArtist[] }>(res)
  return json.data
}

export async function fetchSetlistFmSetlists(
  token: string,
  mbid: string,
  page = 1,
): Promise<{ data: SetlistFmSetlist[]; total: number; page: number }> {
  const res = await fetch(
    `${API_BASE}/api/setlists/setlistfm/${encodeURIComponent(mbid)}/setlists?p=${page}`,
    { headers: authHeaders(token) },
  )
  return handleResponse(res)
}
