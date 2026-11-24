export interface FanAccount {
  id: number
  email: string
  name: string
  newsletter_subscribed: boolean
  /** The name shown on the fan's comments; null until they first comment. */
  display_name?: string | null
  /** True when the band has blocked this fan from commenting. */
  comments_blocked?: boolean
  /** Whether the account has a password. Absent in a fan stored before it existed. */
  has_password?: boolean
  /** Changing the password asks for the current one (not right after a link sign-in). */
  password_needs_current?: boolean
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
