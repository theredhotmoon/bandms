import { ref, watch, type Ref } from 'vue'
import type { AuthError, AuthNotice } from '@/utils/authQuery'

/**
 * The account page's one-off messages. Each belongs to the session it was
 * shown in, so all of them go when another session replaces it. A session that
 * merely ends takes its own, but not what a social sign-in reported: a lapsed
 * session found on the same visit has nothing to do with that. Signing out, or
 * trying another way to sign in, calls clearAuth().
 *
 * The watch is synchronous on purpose: the link exchange sets the session and
 * then the "password set" notice, and a deferred reset would take that notice
 * away again.
 */
export function useFanNotices(token: Readonly<Ref<string | null>>) {
  const magicLinkSent = ref(false)
  const devLink = ref<string | null>(null)
  const passwordNotice = ref(false)
  // What the social sign-in callback reported, and a provider the link just connected.
  const authError = ref<AuthError | null>(null)
  const authNotice = ref<AuthNotice | null>(null)
  const linkedNow = ref<string | null>(null)

  /** What the last social sign-in reported is about an attempt before this one. */
  function clearAuth(): void {
    authError.value = null
    authNotice.value = null
  }

  function linkSent(link: string | null): void {
    devLink.value = link
    magicLinkSent.value = true
    clearAuth()
  }

  watch(token, (now) => {
    magicLinkSent.value = false
    devLink.value = null
    passwordNotice.value = false
    linkedNow.value = null
    if (now !== null) clearAuth()
  }, { flush: 'sync' })

  return { magicLinkSent, devLink, passwordNotice, authError, authNotice, linkedNow, linkSent, clearAuth }
}
