import type { AuthResponse, LoginPayload, ValidationErrors } from '@/types/auth'

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

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>
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
    // ignore parse errors — keep statusText
  }

  throw new ApiError(response.status, message)
}

export async function loginApi(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<AuthResponse>(response)
}

export async function logoutApi(token: string): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
}
