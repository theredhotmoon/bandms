export type UserRole = 'admin' | 'member' | 'publisher'

export interface AuthUser {
  id: number
  first_name: string
  last_name: string
  email: string
  role: UserRole
  band_member_id: number | null
  email_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  user: AuthUser
  token: string
}

export interface LoginPayload {
  email: string
  password: string
}

/** Shape of Laravel's 422 validation error response. */
export interface ValidationErrors {
  message: string
  errors: Record<string, string[]>
}
