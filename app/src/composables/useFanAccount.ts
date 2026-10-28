import { ref, computed, getCurrentInstance } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import type { FanAccount } from '@/types/fan'
import { logoutFan } from '@/api/fan'

function loadStoredToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('fan_token') : null
  } catch {
    return null
  }
}

function loadStoredFan(): FanAccount | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('fan') : null
    return raw ? (JSON.parse(raw) as FanAccount) : null
  } catch {
    return null
  }
}

// Module-level singletons — shared across the app
const token = ref<string | null>(loadStoredToken())
const fan = ref<FanAccount | null>(loadStoredFan())

export function useFanAccount() {
  let queryClient: ReturnType<typeof useQueryClient> | null = null
  if (getCurrentInstance()) {
    try {
      queryClient = useQueryClient()
    } catch {
      queryClient = null
    }
  }

  const isLoggedIn = computed(() => !!token.value && !!fan.value)

  function setSession(newToken: string, newFan: FanAccount): void {
    token.value = newToken
    fan.value = newFan
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('fan_token', newToken)
        localStorage.setItem('fan', JSON.stringify(newFan))
      } catch {
        // ignore storage errors
      }
    }
  }

  function clearSession(): void {
    // Best-effort server-side invalidation — fire and forget
    if (token.value) {
      logoutFan(token.value).catch(() => {/* ignore */})
    }
    token.value = null
    fan.value = null
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('fan_token')
        localStorage.removeItem('fan')
      } catch {
        // ignore storage errors
      }
    }
    queryClient?.clear()
  }

  return { token, fan, isLoggedIn, setSession, clearSession }
}
