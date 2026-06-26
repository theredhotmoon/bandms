import type { AdminFanAccount, TicketStats } from '@/types/ticket'
import { API_BASE, authHeaders, handleResponse } from './client'

interface FanAccountsResponse {
  data: AdminFanAccount[]
}

export async function fetchFanAccountsAdmin(token: string): Promise<AdminFanAccount[]> {
  const res = await fetch(`${API_BASE}/api/fan-accounts`, {
    headers: authHeaders(token),
  })
  return handleResponse<FanAccountsResponse>(res).then((r) => r.data)
}

export async function fetchTicketStats(token: string): Promise<TicketStats> {
  const res = await fetch(`${API_BASE}/api/admin/ticket-stats`, {
    headers: authHeaders(token),
  })
  return handleResponse<TicketStats>(res)
}
