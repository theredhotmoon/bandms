<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { verifyMagicLink, type VerifyResponse } from '@/api/fan'
import FanSignInOptions from '@/components/fan/FanSignInOptions.vue'
import { consumeClaim, restoreClaim } from '@/utils/fanClaim'
import { linkWasRefused } from '@/utils/fanErrors'
import { useFanAccount } from '@/composables/useFanAccount'
import { useFanNotices } from '@/composables/useFanNotices'
import FanLoginForm from '@/components/fan/FanLoginForm.vue'
import FanMagicLinkSent from '@/components/fan/FanMagicLinkSent.vue'
import FanTicketsList from '@/components/fan/FanTicketsList.vue'
import FanOrdersList from '@/components/fan/FanOrdersList.vue'
import { useFanLocale } from '@/composables/useFanLocale'
import { consumeReturnPath } from '@/utils/returnPath'

// Fans never see the admin's language switcher, so these pages resolve
// their own locale the way the API does — see utils/fanLocale.ts.
useFanLocale()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isLoggedIn, token: sessionToken, fan, setSession, clearSession } = useFanAccount()
const activeTab = ref<'tickets' | 'orders'>('tickets')
const linkError = ref<string | null>(null)
const { magicLinkSent, devLink, passwordNotice, linkSent } = useFanNotices(sessionToken)

function onSignedIn(result: VerifyResponse) {
  setSession(result.token, result.fan)
}

// The emailed sign-in link lands here as /account?token=…. The token is
// single-use, so it is dropped from the URL whatever the answer — a reload
// or a shared screenshot must not carry it.
onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || token === '') return
  // `return` is where the fan asked to sign in from (a news post's comments).
  // Dropped from the URL with the token; honoured only as a path on this site,
  // and only in the browser that asked — see consumeReturnPath().
  const store = typeof localStorage === 'undefined' ? null : localStorage
  const returnTo = consumeReturnPath(route.query.return, store)
  // The claim from a password registration in this browser: read (and removed)
  // before the exchange, so two tabs cannot both present it.
  const claim = consumeClaim(store)
  router.replace({ query: { ...route.query, token: undefined, return: undefined } })
  try {
    const result = await verifyMagicLink(token, claim)
    setSession(result.token, result.fan)
    // A full navigation: the post is served by the public site, not this SPA.
    // The post matters more than the "password set" notice, so it wins.
    if (returnTo) window.location.assign(returnTo)
    else passwordNotice.value = result.password_set === true
  } catch (err) {
    // Unless the link is used up, it may still be good: let it be tried again.
    if (!linkWasRefused(err)) restoreClaim(store, claim)
    linkError.value = t('fan.login.linkInvalid')
  }
})
</script>

<template>
  <main class="fa-page">
    <template v-if="!isLoggedIn">
      <p v-if="linkError" role="alert" data-testid="fan-link-error">{{ linkError }}</p>
      <FanMagicLinkSent v-if="magicLinkSent" :dev-link="devLink" />
      <FanLoginForm v-else @magic-link-sent="linkSent" @signed-in="onSignedIn" />
    </template>

    <template v-else>
      <div class="fa-header">
        <h1>{{ $t('fan.account.title') }}</h1>
        <p>{{ fan!.email }}</p>
        <button class="fa-logout" type="button" @click="clearSession">{{ $t('fan.account.signOut') }}</button>
      </div>

      <p v-if="passwordNotice" role="status" aria-live="polite" data-testid="fan-password-set">{{ $t('fan.account.passwordSet') }}</p>

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
