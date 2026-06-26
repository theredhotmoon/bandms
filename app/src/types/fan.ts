export interface FanAccount {
  id: number
  email: string
  name: string
  newsletter_subscribed: boolean
}

export interface FanTicket {
  uuid: string
  status: 'active' | 'transferred' | 'scanned' | 'voided'
  holder_name: string
  holder_email: string
  ticket_type: string | null
  concert_date: string | null
  venue: string | null
}

export interface FanOrderItem {
  name: string
  quantity: number
  price: number
  ticket_uuids: string[] | null
}

export interface FanOrder {
  uuid: string
  status: string
  total: number
  currency: string
  created_at: string
  items: FanOrderItem[]
}
