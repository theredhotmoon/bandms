import type { SocialLink, SocialLinkPayload } from '@/types/socialLink'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface SocialLinkListResponse { data: SocialLink[] }
interface SocialLinkResponse { data: SocialLink }

export async function fetchProfileSocialLinks(): Promise<SocialLink[]> {
  const res = await fetch(`${API_BASE}/api/band-profile/social-links`, { headers: jsonHeaders })
  return handleResponse<SocialLinkListResponse>(res).then((r) => r.data)
}

export async function createProfileSocialLink(token: string, payload: SocialLinkPayload): Promise<SocialLink> {
  const res = await fetch(`${API_BASE}/api/band-profile/social-links`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SocialLinkResponse>(res).then((r) => r.data)
}

export async function updateProfileSocialLink(
  token: string,
  linkId: number,
  payload: SocialLinkPayload,
): Promise<SocialLink> {
  assertSafeId(linkId)
  const res = await fetch(`${API_BASE}/api/band-profile/social-links/${linkId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<SocialLinkResponse>(res).then((r) => r.data)
}

export async function deleteProfileSocialLink(token: string, linkId: number): Promise<void> {
  assertSafeId(linkId)
  const res = await fetch(`${API_BASE}/api/band-profile/social-links/${linkId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
