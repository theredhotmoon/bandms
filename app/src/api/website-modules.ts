import type { WebsiteModule, WebsiteModulesResponse, SiteSettings } from '@/types/website-module'
import { API_BASE, authHeaders, jsonHeaders, handleResponse } from './client'

export async function fetchModules(token: string): Promise<WebsiteModulesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/modules`, { headers: authHeaders(token) })
  return handleResponse<WebsiteModulesResponse>(res)
}

export async function updateModule(token: string, slug: string, enabled: boolean): Promise<{ data: WebsiteModule }> {
  const res = await fetch(`${API_BASE}/api/admin/modules/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), ...jsonHeaders },
    body: JSON.stringify({ enabled }),
  })
  return handleResponse<{ data: WebsiteModule }>(res)
}

export async function updateSiteSettings(token: string, autoRebuild: boolean): Promise<SiteSettings> {
  const res = await fetch(`${API_BASE}/api/admin/site/settings`, {
    method: 'PUT',
    headers: { ...authHeaders(token), ...jsonHeaders },
    body: JSON.stringify({ auto_rebuild: autoRebuild }),
  })
  return handleResponse<SiteSettings>(res)
}

export async function triggerRebuild(token: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/admin/site/rebuild`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<{ status: string }>(res)
}
