import type { Tag, TagPayload } from '@/types/tag'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface TagListResponse { data: Tag[] }
interface TagResponse { data: Tag }

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(`${API_BASE}/api/tags`, { headers: jsonHeaders })
  return handleResponse<TagListResponse>(res).then((r) => r.data)
}

export async function createTag(token: string, payload: TagPayload): Promise<Tag> {
  const res = await fetch(`${API_BASE}/api/tags`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<TagResponse>(res).then((r) => r.data)
}

export async function updateTag(token: string, id: number, payload: TagPayload): Promise<Tag> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/tags/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<TagResponse>(res).then((r) => r.data)
}

export async function deleteTag(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/tags/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
