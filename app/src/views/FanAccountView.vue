<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { verifyMagicLink } from '@/api/fan'
import { useFanAccount } from '@/composables/useFanAccount'
import FanLoginForm from '@/components/fan/FanLoginForm.vue'
import FanMagicLinkSent from '@/components/fan/FanMagicLinkSent.vue'
import FanTicketsList from '@/components/fan/FanTicketsList.vue'
import FanOrdersList from '@/components/fan/FanOrdersList.vue'
import { useFanLocale } from '@/composables/useFanLocale'

// Fans never see the admin's language switcher, so these pages resolve
// their own locale the way the API does — see utils/fanLocale.ts.
useFanLocale()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isLoggedIn, fan, setSession, clearSession } = useFanAccount()
const activeTab = ref<'tickets' | 'orders'>('tickets')
const devLink = ref<string | null>(null)
const magicLinkSent = ref(false)
const linkError = ref<string | null>(null)

function onMagicLinkSent(link: string | null) {
  devLink.value = link
  magicLinkSent.value = true
}

// The emailed sign-in link lands here as /account?token=…. The token is
// single-use, so it is dropped from the URL whatever the answer — a reload
// or a shared screenshot must not carry it.
onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || token === '') return
  router.replace({ query: { ...route.query, token: undefined } })
  try {
    const result = await verifyMagicLink(token)
    setSession(result.token, result.fan)
  } catch {
    linkError.value = t('fan.login.linkInvalid')
  }
})
</script>

<template>
  <main class="fa-page">
    <template v-if="!isLoggedIn">
      <p v-if="linkError" role="alert" data-testid="fan-link-error">{{ linkError }}</p>
      <FanMagicLinkSent v-if="magicLinkSent" :dev-link="devLink" />
      <FanLoginForm v-else @magic-link-sent="onMagicLinkSent" />
    </template>

    <template v-else>
      <div class="fa-header">
        <h1>{{ $t('fan.account.title') }}</h1>
        <p>{{ fan!.email }}</p>
        <button class="fa-logout" type="button" @click="clearSession">{{ $t('fan.account.signOut') }}</button>
      </div>

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

      <FanTicketsList v-if="activeTab === 'tickets'" />
      <FanOrdersList v-if="activeTab === 'orders'" />
    </template>
  </main>
</template>
