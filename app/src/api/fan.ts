import { readStoredFanLocale, resolveFanLocale } from '@/utils/fanLocale'
import { API_BASE, authHeaders, jsonHeaders, ApiError, ApiValidationError } from './client'
import type { FanAccount, FanTicket, FanOrder } from '@/types/fan'

export interface MagicLinkResponse {
  message: string
  /**
   * Only present under APP_DEBUG — FanAccountController adds it inside a
   * `config('app.debug')` guard. It was typed as required, which is the
   * "types lie" shape the root CLAUDE.md warns about: the production build
   * rendered a "Click here to sign in" anchor with no href, because nothing
   * anywhere said the field could be missing.
   */
  dev_link?: string
}

export interface VerifyResponse {
  token: string
  fan: FanAccount
}

/**
 * Every fan request states the locale the page is actually rendering in.
 *
 * The browser already sends its own `Accept-Language`, and `SetLocale`
 * (global, api/bootstrap/app.php) honours it — so most of the time this
 * changes nothing. It matters when the two disagree: a fan who followed a
 * `?lang=pl` link, or who chose a language before, reads Polish chrome, and
 * without this the backend would answer from the browser header instead and
 * put an English validation message under a Polish label.
 *
 * Overridden here rather than in client.ts's shared helpers: those are used by
 * the admin too, where the *content* locale is an explicit `?lang=` and the
 * chrome locale is a different axis entirely.
 */
function withFanLocale(headers: Record<string, string>): Record<string, string> {
  return { ...headers, 'Accept-Language': resolveFanLocale({
    search: typeof window === 'undefined' ? '' : window.location.search,
    stored: readStoredFanLocale(),
    browser: typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]),
  }) }
}

/**
 * Fan-specific response handler — does NOT send a 401 to the admin panel.
 * client.ts's handleResponse clears `auth_token` and navigates to adminUrl(),
 * which is wrong for a fan session: a fan holds `fan_token` and belongs on
 * /account.
 */
async function fanHandleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>
  }

  if (response.status === 422) {
    const body = (await response.json()) as { errors: Record<string, string[]> }
    throw new ApiValidationError(body.errors)
  }

  // Deliberately NOT response.statusText, and the status is carried as a
  // field rather than glued to the front of the message.
  //
  // Both halves were the same bug. "500: Internal Server Error" is an English
  // reason phrase shown verbatim to a fan reading Polish — the defect this
  // change exists to remove — and it crowded out the translated fallback the
  // call sites already pass, because a seeded message is never empty. The
  // prefix then became load-bearing: TicketClaimView read its whole claim
  // state machine out of `err.message.startsWith('409')`, which quietly ties
  // a UI branch to the shape of a string meant for a human.
  let message = ''
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    // No JSON body — the caller's translated fallback is the better answer.
  }

  throw new ApiError(response.status, message)
}

export async function requestMagicLink(email: string, name?: string): Promise<MagicLinkResponse> {
  const body: { email: string; name?: string } = { email }
  if (name) body.name = name
  const response = await fetch(`${API_BASE}/api/fan/auth/magic-link`, {
    method: 'POST',
    headers: withFanLocale(jsonHeaders),
    body: JSON.stringify(body),
  })
  return fanHandleResponse<MagicLinkResponse>(response)
}

export async function verifyMagicLink(token: string): Promise<VerifyResponse> {
  const response = await fetch(
    `${API_BASE}/api/fan/auth/verify?token=${encodeURIComponent(token)}`,
    { headers: withFanLocale({ Accept: 'application/json' }) },
  )
  return fanHandleResponse<VerifyResponse>(response)
}

export async function fetchFanMe(authToken: string): Promise<FanAccount> {
  const response = await fetch(`${API_BASE}/api/fan/me`, {
    headers: withFanLocale(authHeaders(authToken)),
  })
  return fanHandleResponse<FanAccount>(response)
}

export async function fetchFanTickets(authToken: string): Promise<FanTicket[]> {
  const response = await fetch(`${API_BASE}/api/fan/tickets`, {
    headers: withFanLocale(authHeaders(authToken)),
  })
  return fanHandleResponse<FanTicket[]>(response)
}

export async function fetchFanOrders(authToken: string): Promise<FanOrder[]> {
  const response = await fetch(`${API_BASE}/api/fan/orders`, {
    headers: withFanLocale(authHeaders(authToken)),
  })
  return fanHandleResponse<FanOrder[]>(response)
}

export interface InitiateTransferResponse {
  message: string
  /** Debug-only, same as MagicLinkResponse.dev_link. */
  dev_link?: string
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
  const response = await fetch(`${API_BASE}/api/fan/tickets/${encodeURIComponent(ticketUuid)}/transfer`, {
    method: 'POST',
    headers: withFanLocale(authHeaders(authToken)),
    body: JSON.stringify({ to_email: toEmail }),
  })
  return fanHandleResponse<InitiateTransferResponse>(response)
}

export async function claimTransfer(token: string): Promise<ClaimTransferResponse> {
  const response = await fetch(`${API_BASE}/api/tickets/claim/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: withFanLocale({ Accept: 'application/json', 'Content-Type': 'application/json' }),
  })
  return fanHandleResponse<ClaimTransferResponse>(response)
}

export async function logoutFan(authToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/fan/auth/logout`, {
    method: 'POST',
    headers: withFanLocale(authHeaders(authToken)),
  })
  // Ignore errors — we clear local state regardless
  if (!response.ok) return
  await response.json()
}
