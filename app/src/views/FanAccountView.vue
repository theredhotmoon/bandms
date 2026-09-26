<script setup lang="ts">
import { ref } from 'vue'
import { useFanAccount } from '@/composables/useFanAccount'
import FanLoginForm from '@/components/fan/FanLoginForm.vue'
import FanMagicLinkSent from '@/components/fan/FanMagicLinkSent.vue'
import FanTicketsList from '@/components/fan/FanTicketsList.vue'
import FanOrdersList from '@/components/fan/FanOrdersList.vue'
import { useFanLocale } from '@/composables/useFanLocale'

// Fans never see the admin's language switcher, so these pages resolve
// their own locale the way the API does — see utils/fanLocale.ts.
useFanLocale()

const { isLoggedIn, fan, clearSession } = useFanAccount()
const activeTab = ref<'tickets' | 'orders'>('tickets')
const devLink = ref<string | null>(null)
const magicLinkSent = ref(false)

function onMagicLinkSent(link: string | null) {
  devLink.value = link
  magicLinkSent.value = true
}
</script>

<template>
  <main class="fa-page">
    <template v-if="!isLoggedIn">
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
