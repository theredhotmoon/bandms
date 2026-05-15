import type { Author, AuthorPayload, AuthorSummary } from '@/types/author'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface AuthorListResponse { data: AuthorSummary[] }
interface AuthorResponse     { data: Author }

export async function fetchAuthors(): Promise<AuthorSummary[]> {
  const res = await fetch(`${API_BASE}/api/authors`, { headers: jsonHeaders })
  return handleResponse<AuthorListResponse>(res).then((r) => r.data)
}

export async function fetchAuthor(id: number): Promise<Author> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/authors/${id}`, { headers: jsonHeaders })
  return handleResponse<AuthorResponse>(res).then((r) => r.data)
}

export async function createAuthor(token: string, payload: AuthorPayload): Promise<Author> {
  const res = await fetch(`${API_BASE}/api/authors`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<AuthorResponse>(res).then((r) => r.data)
}

export async function updateAuthor(token: string, id: number, payload: AuthorPayload): Promise<Author> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/authors/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<AuthorResponse>(res).then((r) => r.data)
}

export async function deleteAuthor(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/authors/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
