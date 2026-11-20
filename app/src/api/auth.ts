import type { AuthResponse, AuthUser, LoginPayload } from '@/types/auth'
import { API_BASE, ApiError, ApiValidationError, authHeaders, handleResponse, jsonHeaders } from './client'

export { ApiError, ApiValidationError }

export async function loginApi(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  // A 401 here is bad credentials, not an expired session — see redirectOn401.
  return handleResponse<AuthResponse>(response, { redirectOn401: false })
}

/** The signed-in user as the server sees them now — flags included. */
export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/user`, { headers: authHeaders(token) })
  return handleResponse<AuthUser>(response)
}

export async function logoutApi(token: string): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
}
