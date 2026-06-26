import { ref, computed } from 'vue'
import type { FanAccount } from '@/types/fan'

// Module-level singletons — shared across the app
const token = ref<string | null>(localStorage.getItem('fan_token'))

function loadStoredFan(): FanAccount | null {
  try {
    const raw = localStorage.getItem('fan')
    return raw ? (JSON.parse(raw) as FanAccount) : null
  } catch {
    return null
  }
}

const fan = ref<FanAccount | null>(loadStoredFan())

export function useFanAccount() {
  const isLoggedIn = computed(() => !!token.value && !!fan.value)

  function setSession(newToken: string, newFan: FanAccount): void {
    token.value = newToken
    fan.value = newFan
    localStorage.setItem('fan_token', newToken)
    localStorage.setItem('fan', JSON.stringify(newFan))
  }

  function clearSession(): void {
    token.value = null
    fan.value = null
    localStorage.removeItem('fan_token')
    localStorage.removeItem('fan')
  }

  return { token, fan, isLoggedIn, setSession, clearSession }
}
