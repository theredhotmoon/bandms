import type { BandLogo, BandLogoPayload } from '@/types/bandLogo'
import { API_BASE, authHeaders, handleResponse, assertSafeId } from './client'

interface LogoListResponse { data: BandLogo[] }
interface LogoResponse     { data: BandLogo }

export async function fetchBandLogos(token: string): Promise<BandLogo[]> {
  const res = await fetch(`${API_BASE}/api/band-profile/logos`, {
    headers: authHeaders(token),
  })
  return handleResponse<LogoListResponse>(res).then((r) => r.data)
}

export async function uploadBandLogo(
  token: string,
  file: File,
  meta: Omit<BandLogoPayload, 'is_deprecated' | 'sort_order'>,
): Promise<BandLogo> {
  const body = new FormData()
  body.append('file', file)
  if (meta.label)         body.append('label', meta.label)
  if (meta.variant)       body.append('variant', meta.variant)
  if (meta.background)    body.append('background', meta.background)
  if (meta.version_label) body.append('version_label', meta.version_label)
  if (meta.notes)         body.append('notes', meta.notes)
  const res = await fetch(`${API_BASE}/api/band-profile/logos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body,
  })
  return handleResponse<LogoResponse>(res).then((r) => r.data)
}

export async function updateBandLogo(
  token: string,
  id: number,
  payload: BandLogoPayload,
): Promise<BandLogo> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/band-profile/logos/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<LogoResponse>(res).then((r) => r.data)
}

export async function setDefaultLogo(token: string, id: number): Promise<BandLogo> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/band-profile/logos/${id}/set-default`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<LogoResponse>(res).then((r) => r.data)
}

export async function deleteBandLogo(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/band-profile/logos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
