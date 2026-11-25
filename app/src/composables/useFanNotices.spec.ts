import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { useFanNotices } from './useFanNotices'

function setup(initial: string | null) {
  const token = ref<string | null>(initial)
  const scope = effectScope()
  const notices = scope.run(() => useFanNotices(token))!
  return { token, notices, scope }
}

describe('useFanNotices', () => {
  it('shows "password set" after the exchange that opened the session', () => {
    const { token, notices } = setup('old')
    token.value = 'new'
    notices.passwordNotice.value = true
    expect(notices.passwordNotice.value).toBe(true)
  })

  it('forgets every notice when the session ends', () => {
    const { token, notices } = setup('a')
    notices.passwordNotice.value = true
    notices.linkSent('https://site.test/account?token=x')
    token.value = null
    expect(notices.passwordNotice.value).toBe(false)
    expect(notices.magicLinkSent.value).toBe(false)
    expect(notices.devLink.value).toBeNull()
  })

  it('drops what the last social sign-in reported once a link is on its way', () => {
    const { notices } = setup(null)
    notices.authError.value = 'failed'
    notices.authNotice.value = 'confirm_email'
    notices.linkSent(null)
    expect(notices.authError.value).toBeNull()
    expect(notices.authNotice.value).toBeNull()
    expect(notices.magicLinkSent.value).toBe(true)
  })

  it('keeps what a social sign-in reported when the session on the page turns out to have lapsed', () => {
    const { token, notices } = setup('stale')
    notices.authError.value = 'cancelled'
    notices.authNotice.value = 'confirm_email'
    token.value = null
    expect(notices.authError.value).toBe('cancelled')
    expect(notices.authNotice.value).toBe('confirm_email')
  })

  it('drops it when a session begins, and on request', () => {
    const { token, notices } = setup(null)
    notices.authError.value = 'failed'
    notices.authNotice.value = 'confirm_email'
    token.value = 'new'
    expect(notices.authError.value).toBeNull()
    expect(notices.authNotice.value).toBeNull()
    notices.authError.value = 'failed'
    notices.clearAuth()
    expect(notices.authError.value).toBeNull()
  })

  it('forgets them when another session replaces this one', () => {
    const { token, notices } = setup(null)
    notices.linkSent(null)
    expect(notices.magicLinkSent.value).toBe(true)
    token.value = 'a'
    expect(notices.magicLinkSent.value).toBe(false)
    notices.passwordNotice.value = true
    token.value = 'b'
    expect(notices.passwordNotice.value).toBe(false)
  })
})
