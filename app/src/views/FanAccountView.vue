<script setup lang="ts">
import { ref } from 'vue'
import { useFanAccount } from '@/composables/useFanAccount'
import FanLoginForm from '@/components/fan/FanLoginForm.vue'
import FanMagicLinkSent from '@/components/fan/FanMagicLinkSent.vue'
import FanTicketsList from '@/components/fan/FanTicketsList.vue'
import FanOrdersList from '@/components/fan/FanOrdersList.vue'

const { isLoggedIn, fan, clearSession } = useFanAccount()
const activeTab = ref<'tickets' | 'orders'>('tickets')
const devLink = ref<string | null>(null)
const magicLinkSent = ref(false)

function onMagicLinkSent(link: string) {
  devLink.value = link
  magicLinkSent.value = true
}
</script>

<template>
  <main class="fa-page">
    <template v-if="!isLoggedIn">
      <FanMagicLinkSent v-if="magicLinkSent" :dev-link="devLink!" />
      <FanLoginForm v-else @magic-link-sent="onMagicLinkSent" />
    </template>

    <template v-else>
      <div class="fa-header">
        <h1>My Account</h1>
        <p>{{ fan!.email }}</p>
        <button class="fa-logout" type="button" @click="clearSession">Sign out</button>
      </div>

      <div class="fa-tabs" role="tablist">
        <button
          role="tab"
          :aria-selected="activeTab === 'tickets'"
          class="fa-tab"
          :class="{ 'fa-tab--active': activeTab === 'tickets' }"
          type="button"
          @click="activeTab = 'tickets'"
        >My Tickets</button>
        <button
          role="tab"
          :aria-selected="activeTab === 'orders'"
          class="fa-tab"
          :class="{ 'fa-tab--active': activeTab === 'orders' }"
          type="button"
          @click="activeTab = 'orders'"
        >Order History</button>
      </div>

      <FanTicketsList v-if="activeTab === 'tickets'" />
      <FanOrdersList v-if="activeTab === 'orders'" />
    </template>
  </main>
</template>
