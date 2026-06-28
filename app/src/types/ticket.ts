export interface PriceTier {
  id: number
  name: string
  price: number
  currency: string
  available_from: string | null
  available_until: string | null
  available_count: number | null
  sold_count: number
  sort_order: number
}

export interface ActiveTier extends PriceTier {
  remaining: number | null
}

export interface TicketType {
  id: number
  concert_id: number
  name: string
  description: string | null
  available_from: string | null
  on_sale_until: string | null
  max_per_order: number | null
  sort_order: number
  sold_count: number
  is_on_sale: boolean
  active_tier: ActiveTier | null
  tiers: PriceTier[]
  created_at: string
  updated_at: string
}

export interface TicketTypePayload {
  name: string
  description?: string | null
  available_from?: string | null
  on_sale_until?: string | null
  max_per_order?: number | null
  sort_order?: number
  price?: number | null
  currency?: string | null
  total_tickets?: number | null
}

export interface PriceTierPayload {
  name: string
  price: number
  currency: string
  available_from?: string | null
  available_until?: string | null
  available_count?: number | null
  sort_order?: number
}

export interface DoorCheckResult {
  valid: boolean
  reason?: string
  scanned?: boolean
  scanned_at?: string | null
  ticket_type?: string
  concert?: string
  concert_date?: string
  customer?: string
  order_uuid?: string
}

export interface PromoCode {
  id: number
  code: string
  discount_type: 'percent' | 'fixed'
  value: number
  max_uses: number | null
  used_count: number
  expires_at: string | null
  ticket_type_id: number | null
  created_at: string
  updated_at: string
}

export interface PromoCodePayload {
  code: string
  discount_type: 'percent' | 'fixed'
  value: number
  max_uses?: number | null
  expires_at?: string | null
  ticket_type_id?: number | null
}
