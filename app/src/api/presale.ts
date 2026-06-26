import type { PresaleCode } from '@/types/presale'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

// ── Admin ────────────────────────────────────────────────────────────────────

export async function fetchPresaleCodes(token: string, concertId?: number): Promise<PresaleCode[]> {
  const url = new URL(`${API_BASE}/api/presale-codes`)
  if (concertId !== undefined) {
    assertSafeId(concertId)
    url.searchParams.set('concert_id', String(concertId))
  }
  const res = await fetch(url.toString(), { headers: authHeaders(token) })
  return handleResponse<PresaleCode[]>(res)
}

export interface CreatePresaleCodesPayload {
  description: string
  concert_id?: number
  max_uses?: number
  valid_from?: string
  valid_until?: string
  tier_ids?: number[]
  count?: number
  code?: string
}

export async function createPresaleCodes(
  token: string,
  payload: CreatePresaleCodesPayload,
): Promise<PresaleCode[]> {
  const res = await fetch(`${API_BASE}/api/presale-codes`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<PresaleCode[]>(res)
}

export async function deletePresaleCode(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/presale-codes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

// ── Public ───────────────────────────────────────────────────────────────────

export async function validatePresaleCode(
  code: string,
  concertId: number,
): Promise<{ valid: boolean; tier_ids?: number[]; message?: string }> {
  const res = await fetch('/api/presale-codes/validate', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ code, concert_id: concertId }),
  })
  return handleResponse<{ valid: boolean; tier_ids?: number[]; message?: string }>(res)
}
