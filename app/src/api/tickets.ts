import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'
import type { TicketType, PriceTier, TicketTypePayload, PriceTierPayload, DoorCheckResult, PromoCode, PromoCodePayload } from '@/types/ticket'

export async function getConcertTickets(concertId: number): Promise<TicketType[]> {
  assertSafeId(concertId)
  const res = await fetch(`${API_BASE}/api/concerts/${concertId}/tickets`, { headers: jsonHeaders })
  return handleResponse<{ data: TicketType[] }>(res).then((r) => r.data)
}

export async function createTicketType(token: string, concertId: number, payload: TicketTypePayload): Promise<TicketType> {
  assertSafeId(concertId)
  const res = await fetch(`${API_BASE}/api/concerts/${concertId}/tickets`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload),
  })
  return handleResponse<{ data: TicketType }>(res).then((r) => r.data)
}

export async function updateTicketType(token: string, concertId: number, typeId: number, payload: TicketTypePayload): Promise<TicketType> {
  assertSafeId(concertId); assertSafeId(typeId)
  const res = await fetch(`${API_BASE}/api/concerts/${concertId}/tickets/${typeId}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(payload),
  })
  return handleResponse<{ data: TicketType }>(res).then((r) => r.data)
}

export async function deleteTicketType(token: string, concertId: number, typeId: number): Promise<void> {
  assertSafeId(concertId); assertSafeId(typeId)
  const res = await fetch(`${API_BASE}/api/concerts/${concertId}/tickets/${typeId}`, {
    method: 'DELETE', headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function createPriceTier(token: string, concertId: number, typeId: number, payload: PriceTierPayload): Promise<PriceTier> {
  assertSafeId(concertId); assertSafeId(typeId)
  const res = await fetch(`${API_BASE}/api/concerts/${concertId}/tickets/${typeId}/tiers`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload),
  })
  return handleResponse<PriceTier>(res)
}

export async function updatePriceTier(token: string, concertId: number, typeId: number, tierId: number, payload: PriceTierPayload): Promise<PriceTier> {
  assertSafeId(concertId); assertSafeId(typeId); assertSafeId(tierId)
  const res = await fetch(`${API_BASE}/api/concerts/${concertId}/tickets/${typeId}/tiers/${tierId}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(payload),
  })
  return handleResponse<PriceTier>(res)
}

export async function deletePriceTier(token: string, concertId: number, typeId: number, tierId: number): Promise<void> {
  assertSafeId(concertId); assertSafeId(typeId); assertSafeId(tierId)
  const res = await fetch(`${API_BASE}/api/concerts/${concertId}/tickets/${typeId}/tiers/${tierId}`, {
    method: 'DELETE', headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}

export async function doorCheck(token: string, code: string): Promise<DoorCheckResult> {
  const res = await fetch(`${API_BASE}/api/door-check`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify({ code }),
  })
  return handleResponse<DoorCheckResult>(res)
}

export async function doorScan(token: string, code: string): Promise<DoorCheckResult> {
  const res = await fetch(`${API_BASE}/api/door-check/scan`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify({ code }),
  })
  return handleResponse<DoorCheckResult>(res)
}

export async function getPromoCodes(token: string): Promise<PromoCode[]> {
  const res = await fetch(`${API_BASE}/api/promo-codes`, { headers: authHeaders(token) })
  return handleResponse<PromoCode[]>(res)
}

export async function createPromoCode(token: string, payload: PromoCodePayload): Promise<PromoCode> {
  const res = await fetch(`${API_BASE}/api/promo-codes`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload),
  })
  return handleResponse<PromoCode>(res)
}

export async function deletePromoCode(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/promo-codes/${id}`, {
    method: 'DELETE', headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
