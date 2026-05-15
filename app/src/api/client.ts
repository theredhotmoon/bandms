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
    window.location.href = '/login'
    return new Promise(() => {}) as Promise<T>
  }

  if (response.status === 422) {
    const body = (await response.json()) as ValidationErrors
    throw new ApiValidationError(body.errors)
  }

  let message = response.statusText
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    // keep statusText
  }

  throw new ApiError(response.status, message)
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

export { API_BASE }
