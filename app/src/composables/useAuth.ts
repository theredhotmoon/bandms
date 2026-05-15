import { computed, ref } from 'vue'
import { loginApi, logoutApi } from '@/api/auth'
import type { AuthUser, LoginPayload } from '@/types/auth'

// Module-level singletons so auth state is shared across the entire app.
const token = ref<string | null>(localStorage.getItem('auth_token'))

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

const user = ref<AuthUser | null>(loadStoredUser())

function persistToken(t: string | null): void {
  token.value = t
  if (t) {
    localStorage.setItem('auth_token', t)
  } else {
    localStorage.removeItem('auth_token')
  }
}

function persistUser(u: AuthUser | null): void {
  user.value = u
  if (u) {
    localStorage.setItem('auth_user', JSON.stringify(u))
  } else {
    localStorage.removeItem('auth_user')
  }
}

export function useAuth() {
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
      await logoutApi(token.value)
    }
    persistToken(null)
    persistUser(null)
  }

  return { token, user, isLoggedIn, isAdmin, isMember, isPublisher, login, logout }
}
