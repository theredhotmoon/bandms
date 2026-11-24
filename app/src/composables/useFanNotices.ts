import { ref, watch, type Ref } from 'vue'

/**
 * The account page's one-off messages. Each belongs to the session it was
 * shown in, so all of them go when that session ends or another replaces it.
 *
 * The watch is synchronous on purpose: the link exchange sets the session and
 * then the "password set" notice, and a deferred reset would take that notice
 * away again.
 */
export function useFanNotices(token: Readonly<Ref<string | null>>) {
  const magicLinkSent = ref(false)
  const devLink = ref<string | null>(null)
  const passwordNotice = ref(false)

  function linkSent(link: string | null): void {
    devLink.value = link
    magicLinkSent.value = true
  }

  watch(token, () => {
    magicLinkSent.value = false
    devLink.value = null
    passwordNotice.value = false
  }, { flush: 'sync' })

  return { magicLinkSent, devLink, passwordNotice, linkSent }
}
