export interface Instrument {
  id: number
  name: string
  category: string | null
  created_at: string
  updated_at: string
}

export interface InstrumentPayload {
  name: string
  category?: string | null
}
