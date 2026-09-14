import type { WebsiteModule, WebsiteModuleSettingsPayload, WebsiteModulesResponse } from '@/types/website-module'
import { API_BASE, authHeaders, handleResponse, assertSafeSlug } from './client'

export async function fetchModules(token: string): Promise<WebsiteModulesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/modules`, { headers: authHeaders(token) })
  return handleResponse<WebsiteModulesResponse>(res)
}

export async function updateModule(token: string, slug: string, enabled: boolean): Promise<{ data: WebsiteModule }> {
  assertSafeSlug(slug)
  const res = await fetch(`${API_BASE}/api/admin/modules/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ enabled }),
  })
  return handleResponse<{ data: WebsiteModule }>(res)
}

export async function reorderModules(token: string, slugs: string[]): Promise<WebsiteModulesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/modules/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ slugs }),
  })
  return handleResponse<WebsiteModulesResponse>(res)
}

export async function updateModuleSettings(
  token: string,
  slug: string,
  payload: WebsiteModuleSettingsPayload,
): Promise<{ data: WebsiteModule }> {
  assertSafeSlug(slug)
  const res = await fetch(`${API_BASE}/api/admin/modules/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<{ data: WebsiteModule }>(res)
}
