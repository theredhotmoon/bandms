import type { ActivityFilterOptions, ActivityFilters, ActivityPage } from '@/types/activity'
import { activityQueryParams } from '@/utils/activityFilters'
import { API_BASE, authHeaders, handleResponse } from './client'

function token(): string {
  return localStorage.getItem('auth_token') ?? ''
}

export async function fetchActivity(filters: ActivityFilters): Promise<ActivityPage> {
  // URLSearchParams encodes every value; the filter util only emits known keys.
  const params = activityQueryParams(filters)
  // From/To are days in this browser's time zone; the API stores UTC.
  if (params.from || params.to) params.tz_offset = String(new Date().getTimezoneOffset())
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`${API_BASE}/api/admin/activity${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(token()),
  })
  return handleResponse<ActivityPage>(res)
}

export async function fetchActivityFilterOptions(): Promise<ActivityFilterOptions> {
  const res = await fetch(`${API_BASE}/api/admin/activity/filters`, {
    headers: authHeaders(token()),
  })
  return (await handleResponse<{ data: ActivityFilterOptions }>(res)).data
}
