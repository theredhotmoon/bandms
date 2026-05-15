import type { ManagedUser, UserPayload } from '@/types/user'
import { API_BASE, assertSafeId, authHeaders, handleResponse } from './client'

function token(): string {
  return localStorage.getItem('auth_token') ?? ''
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const res = await fetch(`${API_BASE}/api/users`, {
    headers: authHeaders(token()),
  })
  return handleResponse<ManagedUser[]>(res)
}

export async function createUser(payload: UserPayload): Promise<ManagedUser> {
  const res = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: authHeaders(token()),
    body: JSON.stringify(payload),
  })
  return handleResponse<ManagedUser>(res)
}

export async function updateUser(id: number, payload: Partial<UserPayload>): Promise<ManagedUser> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/users/${id}`, {
    method: 'PUT',
    headers: authHeaders(token()),
    body: JSON.stringify(payload),
  })
  return handleResponse<ManagedUser>(res)
}

export async function deleteUser(id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token()),
  })
  return handleResponse<void>(res)
}
