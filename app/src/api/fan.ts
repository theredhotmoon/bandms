import { API_BASE, authHeaders, jsonHeaders, ApiValidationError } from './client'
import type { FanAccount, FanTicket, FanOrder } from '@/types/fan'

export interface MagicLinkResponse {
  message: string
  dev_link: string
}

export interface VerifyResponse {
  token: string
  fan: FanAccount
}

/**
 * Fan-specific response handler — does NOT redirect to /login on 401.
 * The admin handleResponse clears auth_token and navigates to /login, which
 * is wrong for fan sessions (fan uses fan_token and /account route).
 */
async function fanHandleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>
  }

  if (response.status === 422) {
    const body = (await response.json()) as { errors: Record<string, string[]> }
    throw new ApiValidationError(body.errors)
  }

  let message = response.statusText
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    // keep statusText
  }

  throw new Error(`${response.status}: ${message}`)
}

export async function requestMagicLink(email: string, name?: string): Promise<MagicLinkResponse> {
  const body: { email: string; name?: string } = { email }
  if (name) body.name = name
  const response = await fetch(`${API_BASE}/fan/auth/magic-link`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  return fanHandleResponse<MagicLinkResponse>(response)
}

export async function verifyMagicLink(token: string): Promise<VerifyResponse> {
  const response = await fetch(
    `${API_BASE}/fan/auth/verify?token=${encodeURIComponent(token)}`,
    { headers: { Accept: 'application/json' } },
  )
  return fanHandleResponse<VerifyResponse>(response)
}

export async function fetchFanMe(authToken: string): Promise<FanAccount> {
  const response = await fetch(`${API_BASE}/fan/me`, {
    headers: authHeaders(authToken),
  })
  return fanHandleResponse<FanAccount>(response)
}

export async function fetchFanTickets(authToken: string): Promise<FanTicket[]> {
  const response = await fetch(`${API_BASE}/fan/tickets`, {
    headers: authHeaders(authToken),
  })
  return fanHandleResponse<FanTicket[]>(response)
}

export async function fetchFanOrders(authToken: string): Promise<FanOrder[]> {
  const response = await fetch(`${API_BASE}/fan/orders`, {
    headers: authHeaders(authToken),
  })
  return fanHandleResponse<FanOrder[]>(response)
}

export interface InitiateTransferResponse {
  message: string
  dev_link: string
}

export interface ClaimTransferResponse {
  message: string
  ticket_uuid: string
}

export async function initiateTransfer(
  authToken: string,
  ticketUuid: string,
  toEmail: string,
): Promise<InitiateTransferResponse> {
  const response = await fetch(`${API_BASE}/fan/tickets/${encodeURIComponent(ticketUuid)}/transfer`, {
    method: 'POST',
    headers: authHeaders(authToken),
    body: JSON.stringify({ to_email: toEmail }),
  })
  return fanHandleResponse<InitiateTransferResponse>(response)
}

export async function claimTransfer(token: string): Promise<ClaimTransferResponse> {
  const response = await fetch(`${API_BASE}/tickets/claim/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  })
  return fanHandleResponse<ClaimTransferResponse>(response)
}

export async function logoutFan(authToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/fan/auth/logout`, {
    method: 'POST',
    headers: authHeaders(authToken),
  })
  // Ignore errors — we clear local state regardless
  if (!response.ok) return
  await response.json()
}
