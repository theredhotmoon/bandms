import type {
  CrawlDispatch,
  CrawlRun,
  CrawlerSettings,
  CrawlerSettingsResponse,
  Finding,
  FindingsFilter,
  FindingsPage,
} from '@/types/assistantCrawler'
import { API_BASE, assertSafeId, authHeaders, handleResponse } from './client'

/** Only the filters that are set go on the URL; `status` always does (the server defaults it to new). */
export function findingsQuery(f: FindingsFilter): string {
  const p = new URLSearchParams({ status: f.status })
  if (f.kind) p.set('kind', f.kind)
  if (f.country) p.set('country', f.country)
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.page > 1) p.set('page', String(f.page))
  return p.toString()
}

export async function fetchFindings(token: string, f: FindingsFilter): Promise<FindingsPage> {
  const res = await fetch(`${API_BASE}/api/admin/assistant/findings?${findingsQuery(f)}`, { headers: authHeaders(token) })
  return handleResponse<FindingsPage>(res)
}

export async function setFindingStatus(token: string, id: number, status: 'new' | 'dismissed'): Promise<Finding> {
  assertSafeId(id, 'finding id')
  const res = await fetch(`${API_BASE}/api/admin/assistant/findings/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  })
  return (await handleResponse<{ data: Finding }>(res)).data
}

export async function fetchCrawlRuns(token: string): Promise<CrawlRun[]> {
  const res = await fetch(`${API_BASE}/api/admin/assistant/runs`, { headers: authHeaders(token) })
  return (await handleResponse<{ data: CrawlRun[] }>(res)).data
}

export async function fetchCrawlerSettings(token: string): Promise<CrawlerSettingsResponse> {
  const res = await fetch(`${API_BASE}/api/admin/assistant/settings`, { headers: authHeaders(token) })
  return handleResponse<CrawlerSettingsResponse>(res)
}

export async function saveCrawlerSettings(token: string, settings: CrawlerSettings): Promise<CrawlerSettingsResponse> {
  const res = await fetch(`${API_BASE}/api/admin/assistant/settings`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(settings),
  })
  return handleResponse<CrawlerSettingsResponse>(res)
}

/** Run now: queue the crawl — one source, or every one that may run. */
export async function runCrawl(token: string, source?: string): Promise<CrawlDispatch> {
  const res = await fetch(`${API_BASE}/api/admin/assistant/run`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(source ? { source } : {}),
  })
  return (await handleResponse<{ data: CrawlDispatch }>(res)).data
}
