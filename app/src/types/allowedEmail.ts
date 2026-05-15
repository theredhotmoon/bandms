import type { UserRole } from './auth'

export interface AllowedEmail {
  id: number
  email: string
  role: UserRole
  band_member_id: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AllowedEmailPayload {
  email: string
  role: UserRole
  band_member_id?: number | null
  notes?: string | null
}
