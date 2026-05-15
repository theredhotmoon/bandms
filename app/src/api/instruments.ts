import type { Instrument, InstrumentPayload } from '@/types/instrument'

const BASE = '/api/instruments'

function assertSafeId(id: unknown): number {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) throw new Error('Invalid id')
  return n
}

export async function fetchInstruments(): Promise<Instrument[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to fetch instruments')
  return res.json() as Promise<Instrument[]>
}

export async function createInstrument(token: string, payload: InstrumentPayload): Promise<Instrument> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to create instrument')
  return res.json() as Promise<Instrument>
}

export async function updateInstrument(token: string, id: number, payload: Partial<InstrumentPayload>): Promise<Instrument> {
  const safeId = assertSafeId(id)
  const res = await fetch(`${BASE}/${safeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to update instrument')
  return res.json() as Promise<Instrument>
}

export async function deleteInstrument(token: string, id: number): Promise<void> {
  const safeId = assertSafeId(id)
  const res = await fetch(`${BASE}/${safeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to delete instrument')
}
