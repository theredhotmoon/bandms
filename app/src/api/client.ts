import { adminUrl } from '@/config/admin'
import type { ValidationErrors } from '@/types/auth'

const API_BASE = import.meta.env.VITE_API_URL as string

export class ApiValidationError extends Error {
  constructor(public readonly errors: Record<string, string[]>) {
    super('Validation failed')
    this.name = 'ApiValidationError'
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }

  if (response.status === 401) {
    localStorage.removeItem('auth_token')
    window.location.href = adminUrl()
    return new Promise(() => {}) as Promise<T>
  }

  if (response.status === 422) {
    const body = (await response.json()) as ValidationErrors
    // Not every 422 carries a Laravel `errors` bag — a business-rule check
    // (e.g. "You cannot delete your own account.") returns a bare `message`
    // instead. Routing that through ApiValidationError would leave `.errors`
    // undefined and crash saveErrorMessage's `Object.entries(error.errors)`.
    if (body.errors && Object.keys(body.errors).length > 0) {
      throw new ApiValidationError(body.errors)
    }
    throw new ApiError(422, body.message ?? 'Validation failed')
  }

  // Deliberately NOT response.statusText. saveErrorMessage returns
  // ApiError.message ahead of the caller's fallback, so seeding it with an
  // HTTP reason phrase ("Internal Server Error") means a Polish admin reads
  // that instead of the translated text the call site passed — the same
  // defect as the frontend literals this replaced, one branch higher. An
  // empty message lets the fallback through; a real body.message is worth
  // showing, because Laravel's is specific ("You cannot delete your own
  // account.") where a reason phrase never is.
  let message = ''
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    // No JSON body — the caller's translated fallback is the better answer.
  }

  throw new ApiError(response.status, message)
}

/**
 * A save error as a sentence worth showing the user.
 *
 * A rig is validated per key (`extra_inputs.3.instrument`), so a rejection
 * carries exactly which row of which section failed — information a generic
 * "Failed to save" toast throws away, leaving the user to hunt a form with
 * five tabs. The field path is kept: it is the only pointer to the row.
 */
export function saveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiValidationError) {
    const [field, messages] = Object.entries(error.errors)[0] ?? []
    const first = messages?.[0]
    if (!first) return fallback
    return field ? `${first} (${field})` : first
  }

  if (error instanceof ApiError && error.message) {
    return error.message
  }

  // The Facebook-likes sync still does its own fetch and throws a plain Error
  // carrying the backend's message; dropping it for the generic string would
  // hide the only useful detail. (music-video metadata/sync used to be here
  // too and now goes through handleResponse.)
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

/** Throws if id is not a safe positive integer (prevents URL injection). */
export function assertSafeId(id: unknown): asserts id is number {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid resource id: ${String(id)}`)
  }
}

/** Throws if slug is not a safe non-empty string (prevents URL injection). */
export function assertSafeSlug(slug: unknown): asserts slug is string {
  if (typeof slug !== 'string' || slug.trim() === '' || /[/?#\\]/.test(slug)) {
    throw new Error(`Invalid slug: ${String(slug)}`)
  }
}

export { API_BASE }
