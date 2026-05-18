import type { Post, PostPayload, PostSummary } from '@/types/post'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface PostListResponse {
  data: PostSummary[]
  meta?: PaginationMeta
}

interface PostResponse { data: Post }

export interface PostFilters {
  search?: string
  tag_id?: number
  page?: number
}

export async function fetchPosts(filters: PostFilters = {}): Promise<PostListResponse> {
  const params = new URLSearchParams()
  if (filters.search)  params.set('search', filters.search)
  if (filters.tag_id)  params.set('tag_id', String(filters.tag_id))
  if (filters.page)    params.set('page', String(filters.page))

  const qs = params.size ? `?${params}` : ''
  const res = await fetch(`${API_BASE}/api/posts${qs}`, { headers: jsonHeaders })
  const raw = await handleResponse<{ data: PostSummary[]; meta?: PaginationMeta }>(res)
  return { data: raw.data, meta: raw.meta }
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
