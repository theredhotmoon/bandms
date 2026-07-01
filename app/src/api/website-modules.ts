import type { WebsiteModule, WebsiteModulesResponse, SiteSettings, RebuildStatus } from '@/types/website-module'
import { API_BASE, authHeaders, handleResponse, assertSafeSlug } from './client'

const REBUILD_STATUSES = ['idle', 'building', 'done', 'error', 'unknown'] as const

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

export async function updateSiteSettings(token: string, autoRebuild: boolean): Promise<SiteSettings> {
  const res = await fetch(`${API_BASE}/api/admin/site/settings`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ auto_rebuild: autoRebuild }),
  })
  return handleResponse<SiteSettings>(res)
}

export async function triggerRebuild(token: string): Promise<Pick<RebuildStatus, 'status'>> {
  const res = await fetch(`${API_BASE}/api/admin/site/rebuild`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<Pick<RebuildStatus, 'status'>>(res)
}

export async function fetchRebuildStatus(token: string): Promise<RebuildStatus> {
  const res = await fetch(`${API_BASE}/api/admin/site/rebuild/status`, { headers: authHeaders(token) })
  const raw = await handleResponse<Record<string, unknown>>(res)
  const status = REBUILD_STATUSES.includes(raw.status as RebuildStatus['status'])
    ? (raw.status as RebuildStatus['status'])
    : 'unknown'
  return {
    status,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : null,
    finishedAt: typeof raw.finishedAt === 'number' ? raw.finishedAt : null,
  }
}
