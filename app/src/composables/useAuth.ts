import { computed, getCurrentInstance, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { loginApi, logoutApi } from '@/api/auth'
import type { AuthUser, LoginPayload } from '@/types/auth'

function loadStoredToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null
  } catch {
    return null
  }
}

function loadStoredUser(): AuthUser | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_user') : null
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

// Module-level singletons so auth state is shared across the entire app.
const token = ref<string | null>(loadStoredToken())
const user = ref<AuthUser | null>(loadStoredUser())

function persistToken(t: string | null): void {
  token.value = t
  if (typeof localStorage === 'undefined') return
  try {
    if (t) {
      localStorage.setItem('auth_token', t)
    } else {
      localStorage.removeItem('auth_token')
    }
  } catch {
    // ignore storage errors
  }
}

function persistUser(u: AuthUser | null): void {
  user.value = u
  if (typeof localStorage === 'undefined') return
  try {
    if (u) {
      localStorage.setItem('auth_user', JSON.stringify(u))
    } else {
      localStorage.removeItem('auth_user')
    }
  } catch {
    // ignore storage errors
  }
}

export function clearAuthSession(): void {
  persistToken(null)
  persistUser(null)
}

export function useAuth() {
  let queryClient: ReturnType<typeof useQueryClient> | null = null
  if (getCurrentInstance()) {
    try {
      queryClient = useQueryClient()
    } catch {
      queryClient = null
    }
  }

  const isLoggedIn  = computed(() => token.value !== null)
  const isAdmin     = computed(() => user.value?.role === 'admin')
  const isMember    = computed(() => user.value?.role === 'member')
  const isPublisher = computed(() => user.value?.role === 'publisher')

  async function login(payload: LoginPayload): Promise<void> {
    const data = await loginApi(payload)
    persistToken(data.token)
    persistUser(data.user)
  }

  async function logout(): Promise<void> {
    if (token.value) {
      try {
        await logoutApi(token.value)
      } catch {
        // ignore network/401 errors on logout
      }
    }
    clearAuthSession()
    queryClient?.clear()
  }

  return { token, user, isLoggedIn, isAdmin, isMember, isPublisher, login, logout }
}
