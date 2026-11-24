<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { verifyMagicLink, type VerifyResponse } from '@/api/fan'
import FanSignInOptions from '@/components/fan/FanSignInOptions.vue'
import { browserStore, consumeClaim, dropKeptClaim, putBackKeptClaim, restoreClaim } from '@/utils/fanClaim'
import { linkWasRefused } from '@/utils/fanErrors'
import { useFanAccount } from '@/composables/useFanAccount'
import { useFanNotices } from '@/composables/useFanNotices'
import FanLoginForm from '@/components/fan/FanLoginForm.vue'
import FanMagicLinkSent from '@/components/fan/FanMagicLinkSent.vue'
import FanTicketsList from '@/components/fan/FanTicketsList.vue'
import FanOrdersList from '@/components/fan/FanOrdersList.vue'
import { useFanLocale } from '@/composables/useFanLocale'
import { consumeReturnPath } from '@/utils/returnPath'
import { providerName, readAuthQuery, stripFacebookHash } from '@/utils/authQuery'

// Fans never see the admin's language switcher, so these pages resolve
// their own locale the way the API does — see utils/fanLocale.ts.
useFanLocale()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isLoggedIn, token: sessionToken, fan, setSession, clearSession } = useFanAccount()
const activeTab = ref<'tickets' | 'orders'>('tickets')
const linkError = ref<string | null>(null)
const {
  magicLinkSent, devLink, passwordNotice, authError, authNotice, linkedNow, linkSent, clearAuth,
} = useFanNotices(sessionToken)

function onSignedIn(result: VerifyResponse) {
  setSession(result.token, result.fan)
}

function signOut() {
  clearAuth()
  clearSession()
}

// The emailed sign-in link lands here as /account?token=…. The token is
// single-use, so it is dropped from the URL whatever the answer — a reload
// or a shared screenshot must not carry it.
onMounted(async () => {
  // What the social callback reported, shown once and dropped from the URL
  // together with the `#_=_` Facebook appends. The button that began it made a
  // claim: a mail now waits on that one, or it goes and the one before it returns.
  const store = browserStore()
  const auth = readAuthQuery(route.query)
  if (auth.error) putBackKeptClaim(store)
  else if (auth.notice === 'confirm_email') dropKeptClaim(store)
  authError.value = auth.error
  authNotice.value = auth.notice
  const dropsAuth = 'auth_error' in route.query || 'auth_notice' in route.query
  const hash = stripFacebookHash(route.hash)
  const dropsHash = hash !== route.hash

  const token = route.query.token
  if (typeof token !== 'string' || token === '') {
    if (dropsAuth || dropsHash) {
      router.replace({ query: { ...route.query, auth_error: undefined, auth_notice: undefined }, hash })
    }
    return
  }
  // `return` is where the fan asked to sign in from (a news post's comments).
  // Dropped from the URL with the token; honoured only as a path on this site,
  // and only in the browser that asked — see consumeReturnPath().
  const returnTo = consumeReturnPath(route.query.return, store)
  // The claim from a password registration in this browser: read (and removed)
  // before the exchange, so two tabs cannot both present it.
  const claim = consumeClaim(store)
  router.replace({
    query: { ...route.query, token: undefined, return: undefined, auth_error: undefined, auth_notice: undefined },
    hash,
  })
  try {
    const result = await verifyMagicLink(token, claim)
    // Used by this link, or not needed by it: a provider it knew signs in without one.
    if (result.password_set || result.linked) dropKeptClaim(store)
    else putBackKeptClaim(store, claim)
    setSession(result.token, result.fan)
    // A full navigation: the post is served by the public site, not this SPA.
    // The post matters more than the "password set" notice, so it wins.
    if (returnTo) window.location.assign(returnTo)
    else {
      passwordNotice.value = result.password_set === true
      linkedNow.value = result.linked ? providerName(result.linked) || null : null
    }
  } catch (err) {
    // Unless the link is used up, it may still be good: let it be tried again.
    if (linkWasRefused(err)) putBackKeptClaim(store, claim)
    else restoreClaim(store, claim)
    linkError.value = t('fan.login.linkInvalid')
  }
})
</script>

<template>
  <main class="fa-page" :class="{ 'fa-page--signed-out': !isLoggedIn }">
    <p v-if="authError" class="fan-msg fan-msg--error" role="alert" data-testid="fan-auth-error">{{ $t(`fan.login.authError.${authError}`) }}</p>
    <p v-if="authNotice" class="fan-msg" role="status" aria-live="polite" data-testid="fan-auth-notice">{{ $t('fan.login.confirmEmail') }}</p>
    <template v-if="!isLoggedIn">
      <p v-if="linkError" class="fan-msg fan-msg--error" role="alert" data-testid="fan-link-error">{{ linkError }}</p>
      <FanMagicLinkSent v-if="magicLinkSent" :dev-link="devLink" />
      <FanLoginForm v-else @magic-link-sent="linkSent" @signed-in="onSignedIn" @attempt="clearAuth" />
    </template>

    <template v-else>
      <div class="fa-header">
        <div class="fa-who">
          <h1 class="fan-title">{{ $t('fan.account.title') }}</h1>
          <p class="fan-text">{{ fan!.email }}</p>
        </div>
        <button class="fan-btn fan-btn--quiet" type="button" @click="signOut">{{ $t('fan.account.signOut') }}</button>
      </div>

      <p v-if="passwordNotice" class="fan-msg" role="status" aria-live="polite" data-testid="fan-password-set">{{ $t('fan.account.passwordSet') }}</p>

      <p v-if="linkedNow" class="fan-msg" role="status" aria-live="polite" data-testid="fan-linked-now">{{ $t('fan.account.linkedNow', { provider: linkedNow }) }}</p>

      <!-- Keyed by session: a link opened over another session starts it afresh. -->
      <FanSignInOptions :key="sessionToken ?? ''" />

      <div class="fa-tabs" role="tablist">
        <button
          role="tab"
          :aria-selected="activeTab === 'tickets'"
          class="fa-tab"
          :class="{ 'fa-tab--active': activeTab === 'tickets' }"
          type="button"
          @click="activeTab = 'tickets'"
        >{{ $t('fan.account.myTickets') }}</button>
        <button
          role="tab"
          :aria-selected="activeTab === 'orders'"
          class="fa-tab"
          :class="{ 'fa-tab--active': activeTab === 'orders' }"
          type="button"
          @click="activeTab = 'orders'"
        >{{ $t('fan.account.orderHistory') }}</button>
      </div>

      <!-- Keyed by session too: nothing one fan loaded or typed is left for the next. -->
      <FanTicketsList v-if="activeTab === 'tickets'" :key="`tickets-${sessionToken}`" />
      <FanOrdersList v-if="activeTab === 'orders'" :key="`orders-${sessionToken}`" />
    </template>
  </main>
</template>

<style scoped src="../components/fan/fan-styles.css" />
<style scoped>
.fa-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 46rem;
  margin-inline: auto;
  padding: clamp(1.5rem, 5vw, 3rem) max(16px, 4vw) 4rem;
}
.fa-page--signed-out { max-width: 32rem; }

.fa-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.fa-who {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.fa-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 25%, transparent);
}
.fa-tab {
  min-height: 44px;
  margin-bottom: -1px;
  padding: 0.5rem 0;
  border: none;
  border-bottom: 3px solid transparent;
  background: none;
  color: color-mix(in srgb, var(--color-ink) 75%, transparent);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.fa-tab:hover { color: var(--color-ink); }
.fa-tab--active {
  border-bottom-color: var(--color-ink);
  color: var(--color-ink);
}
.fa-tab:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }
</style>
