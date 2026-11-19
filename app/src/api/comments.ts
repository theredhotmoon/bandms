import type { AdminComment, AdminCommentsPage, CommentLimit } from '@/types/comment'
import { API_BASE, authHeaders, handleResponse, assertSafeId } from './client'

export async function fetchAdminComments(token: string, page: number): Promise<AdminCommentsPage> {
  assertSafeId(page, 'page')
  const res = await fetch(`${API_BASE}/api/admin/comments?page=${page}`, { headers: authHeaders(token) })
  return handleResponse<AdminCommentsPage>(res)
}

export async function setCommentHidden(token: string, id: number, hidden: boolean): Promise<{ data: AdminComment }> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/comments/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ hidden }),
  })
  return handleResponse<{ data: AdminComment }>(res)
}

export async function deleteComment(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/comments/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) await handleResponse<unknown>(res)
}

export async function fetchCommentLimit(token: string): Promise<CommentLimit> {
  const res = await fetch(`${API_BASE}/api/admin/comment-settings`, { headers: authHeaders(token) })
  return (await handleResponse<{ data: CommentLimit }>(res)).data
}

export async function saveCommentLimit(token: string, limit: CommentLimit): Promise<CommentLimit> {
  const res = await fetch(`${API_BASE}/api/admin/comment-settings`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(limit),
  })
  return (await handleResponse<{ data: CommentLimit }>(res)).data
}

export async function setFanCommentsBlocked(token: string, fanId: number, blocked: boolean): Promise<void> {
  assertSafeId(fanId)
  const res = await fetch(`${API_BASE}/api/admin/fan-accounts/${fanId}/comments-block`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ blocked }),
  })
  await handleResponse<unknown>(res)
}
