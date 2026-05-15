import type { Post, PostPayload, PostSummary } from '@/types/post'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface PostListResponse { data: PostSummary[] }
interface PostResponse { data: Post }

export interface PostFilters {
  search?: string
  tag_id?: number
}

export async function fetchPosts(filters: PostFilters = {}): Promise<PostSummary[]> {
  const params = new URLSearchParams()
  if (filters.search)  params.set('search', filters.search)
  if (filters.tag_id)  params.set('tag_id', String(filters.tag_id))

  const qs = params.size ? `?${params}` : ''
  const res = await fetch(`${API_BASE}/api/posts${qs}`, { headers: jsonHeaders })
  return handleResponse<PostListResponse>(res).then((r) => r.data)
}

export async function fetchPost(id: number): Promise<Post> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/posts/${id}`, { headers: jsonHeaders })
  return handleResponse<PostResponse>(res).then((r) => r.data)
}

export async function createPost(token: string, payload: PostPayload): Promise<Post> {
  const res = await fetch(`${API_BASE}/api/posts`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<PostResponse>(res).then((r) => r.data)
}

export async function updatePost(token: string, id: number, payload: Partial<PostPayload>): Promise<Post> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/posts/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<PostResponse>(res).then((r) => r.data)
}

export async function deletePost(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/posts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
