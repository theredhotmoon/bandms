export type TicketStatus = 'active' | 'transferred' | 'scanned' | 'voided'

export interface AdminTicket {
  uuid: string
  status: TicketStatus
  holder_name: string | null
  holder_email: string | null
  ticket_type: string | null
}

export interface TicketStats {
  total: number
  active: number
  transferred: number
  scanned: number
  transfer_rate: number
  scan_rate: number
}

export interface AdminFanAccount {
  id: number
  email: string
  name: string
  tickets_count: number
  newsletter_subscribed: boolean
  created_at: string
}
