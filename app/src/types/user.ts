import type { UserRole } from './auth'

export interface ManagedUser {
  id: number
  first_name: string
  last_name: string
  email: string
  role: UserRole
  /** Manages the two switches below and grants itself; always has both features. */
  is_superadmin: boolean
  can_translate: boolean
  can_enhance: boolean
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
  /** Superadmin-only fields — the API 403s them from anyone else. */
  is_superadmin?: boolean
  can_translate?: boolean
  can_enhance?: boolean
}
