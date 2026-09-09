import type { Instrument, InstrumentPayload } from '@bandms/rider-core'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface InstrumentListResponse { data: Instrument[] }
interface InstrumentResponse { data: Instrument }

export async function fetchInstruments(): Promise<Instrument[]> {
  const res = await fetch(`${API_BASE}/api/instruments`, { headers: jsonHeaders })
  return handleResponse<InstrumentListResponse>(res).then((r) => r.data)
}

export async function createInstrument(token: string, payload: InstrumentPayload): Promise<Instrument> {
  const res = await fetch(`${API_BASE}/api/instruments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<InstrumentResponse>(res).then((r) => r.data)
}

export async function updateInstrument(token: string, id: number, payload: Partial<InstrumentPayload>): Promise<Instrument> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/instruments/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<InstrumentResponse>(res).then((r) => r.data)
}

export async function deleteInstrument(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/instruments/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
