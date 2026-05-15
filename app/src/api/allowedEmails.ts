import type { AllowedEmail, AllowedEmailPayload } from '@/types/allowedEmail'
import { API_BASE, authHeaders, handleResponse } from './client'

interface ListResponse   { data: AllowedEmail[] }
interface SingleResponse { data: AllowedEmail }

export async function fetchAllowedEmails(token: string): Promise<AllowedEmail[]> {
  const res = await fetch(`${API_BASE}/api/allowed-emails`, { headers: authHeaders(token) })
  return handleResponse<ListResponse>(res).then((r) => r.data)
}

export async function createAllowedEmail(token: string, payload: AllowedEmailPayload): Promise<AllowedEmail> {
  const res = await fetch(`${API_BASE}/api/allowed-emails`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function updateAllowedEmail(token: string, id: number, payload: Partial<AllowedEmailPayload>): Promise<AllowedEmail> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid id')
  const res = await fetch(`${API_BASE}/api/allowed-emails/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SingleResponse>(res).then((r) => r.data)
}

export async function deleteAllowedEmail(token: string, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid id')
  const res = await fetch(`${API_BASE}/api/allowed-emails/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok && res.status !== 204) await handleResponse(res)
}
