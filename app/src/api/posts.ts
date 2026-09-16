import type { Post, PostPayload, PostSummary } from '@/types/post'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'
import type { Lang } from '@/composables/useLang'

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

/**
 * The admin reads through `/api/admin/posts`, not the public `/api/posts`: the
 * public routes hide drafts (null published_at), and the editor has to see
 * them — its "Draft" filter and the dashboard count would otherwise be empty.
 */
export async function fetchPosts(token: string, filters: PostFilters = {}, lang: Lang = 'en'): Promise<PostListResponse> {
  const res = await fetch(`${API_BASE}/api/admin/posts?${listParams(filters, lang)}`, { headers: authHeaders(token) })
  const raw = await handleResponse<{ data: PostSummary[]; meta?: PaginationMeta }>(res)
  return { data: raw.data, meta: raw.meta }
}

/**
 * Published posts only, as any visitor sees them. For signed-in users whose
 * role may not read `/api/admin/posts` (members) — the dashboard's post count
 * needs *a* number, and a 403 would silently make it zero.
 */
export async function fetchPublicPosts(filters: PostFilters = {}, lang: Lang = 'en'): Promise<PostListResponse> {
  const res = await fetch(`${API_BASE}/api/posts?${listParams(filters, lang)}`, { headers: jsonHeaders })
  const raw = await handleResponse<{ data: PostSummary[]; meta?: PaginationMeta }>(res)
  return { data: raw.data, meta: raw.meta }
}

function listParams(filters: PostFilters, lang: Lang): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search)  params.set('search', filters.search)
  if (filters.tag_id)  params.set('tag_id', String(filters.tag_id))
  if (filters.page)    params.set('page', String(filters.page))
  params.set('lang', lang)
  return params
}

export async function fetchPost(token: string, id: number, lang: Lang = 'en'): Promise<Post> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/posts/${id}?lang=${lang}`, { headers: authHeaders(token) })
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
