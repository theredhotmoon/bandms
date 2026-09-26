import type { BandProfile, BandProfilePayload, CalendarAvailability, CalendarEvent, EpkData, FacebookSyncResult } from '@/types/bandProfile'
import { API_BASE, authHeaders, handleResponse, jsonHeaders } from './client'
import type { Lang } from '@/composables/useLang'

interface BandProfileResponse { data: BandProfile }
interface EpkResponse { data: EpkData }

export async function fetchBandProfile(lang: Lang): Promise<BandProfile> {
  const res = await fetch(`${API_BASE}/api/band-profile?lang=${lang}`, { headers: jsonHeaders })
  return handleResponse<BandProfileResponse>(res).then((r) => r.data)
}

export async function fetchEpk(lang: Lang): Promise<EpkData> {
  const res = await fetch(`${API_BASE}/api/band-profile/epk?lang=${lang}`, { headers: jsonHeaders })
  return handleResponse<EpkResponse>(res).then((r) => r.data)
}

export async function updateBandProfile(token: string, payload: BandProfilePayload): Promise<BandProfile> {
  const res = await fetch(`${API_BASE}/api/band-profile`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<BandProfileResponse>(res).then((r) => r.data)
}

export async function checkCalendarAvailability(date: string): Promise<CalendarAvailability> {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format — expected YYYY-MM-DD')
  const res = await fetch(
    `${API_BASE}/api/band-profile/calendar/availability?date=${encodeURIComponent(date)}`,
    { headers: jsonHeaders },
  )
  return handleResponse<{ data: CalendarAvailability }>(res).then(r => r.data)
}

export async function fetchCalendarEvents(token: string, start: string, end: string): Promise<CalendarEvent[]> {
  if (!start || !end) throw new Error('start and end dates are required')
  const params = new URLSearchParams({ start, end })
  const res = await fetch(
    `${API_BASE}/api/band-profile/calendar/events?${params}`,
    { headers: authHeaders(token) },
  )
  return handleResponse<{ data: CalendarEvent[] }>(res).then(r => r.data)
}

export async function syncFacebookLikes(token: string): Promise<FacebookSyncResult> {
  const res = await fetch(`${API_BASE}/api/band-profile/sync-facebook-likes`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    // No frontend literal. saveErrorMessage returns error.message ahead of the
    // caller's fallback, so seeding one here beat the `fbSyncFailed` translation
    // that already exists with the same English words — and won whenever the
    // endpoint replied without a JSON body (a Caddy 502's HTML, or res.json()
    // rejecting into {}), which is exactly when a Polish admin needed it most.
    // An empty message lets the fallback through; the backend's own message is
    // still worth showing when it sends one.
    throw new Error(err.message ?? '')
  }
  return res.json() as Promise<FacebookSyncResult>
}
