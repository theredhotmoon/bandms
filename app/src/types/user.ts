import type { UserRole } from './auth'

export interface ManagedUser {
  id: number
  first_name: string
  last_name: string
  email: string
  role: UserRole
  band_member_id: number | null
  band_member: { id: number; first_name: string; last_name: string } | null
  created_at: string
  updated_at: string
}

export interface UserPayload {
  first_name: string
  last_name: string
  email: string
  password?: string
  password_confirmation?: string
  role: UserRole
  band_member_id?: number | null
}
