<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { claimTransfer } from '@/api/fan'
import TicketDownloadCard from '@/components/TicketDownloadCard.vue'

type ClaimState = 'loading' | 'success' | 'already_claimed' | 'expired' | 'invalid' | 'error'

const route      = useRoute()
const state      = ref<ClaimState>('loading')
const newUuid    = ref<string | null>(null)
const errorMsg   = ref<string | null>(null)

onMounted(async () => {
  const token = route.params.token
  const tokenStr = Array.isArray(token) ? token[0] : token

  if (!tokenStr) {
    state.value = 'invalid'
    return
  }

  try {
    const res  = await claimTransfer(tokenStr)
    newUuid.value = res.ticket_uuid
    state.value   = 'success'
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.startsWith('409')) {
        state.value = 'already_claimed'
      } else if (err.message.startsWith('410')) {
        state.value = 'expired'
      } else if (err.message.startsWith('404')) {
        state.value = 'invalid'
      } else {
        state.value  = 'error'
        errorMsg.value = err.message
      }
    } else {
      state.value = 'error'
    }
  }
})
</script>

<template>
  <main class="tcv-wrap">
    <div class="tcv-card">
      <!-- Loading -->
      <p v-if="state === 'loading'" class="tcv-msg" role="status" aria-live="polite">
        Claiming your ticket…
      </p>

      <!-- Success -->
      <template v-else-if="state === 'success'">
        <h1 class="tcv-heading">Ticket claimed!</h1>
        <p class="tcv-sub">Your new ticket UUID: <code class="tcv-code">{{ newUuid }}</code></p>
        <TicketDownloadCard v-if="newUuid" :uuid="newUuid" />
      </template>

      <!-- Already claimed -->
      <template v-else-if="state === 'already_claimed'">
        <h1 class="tcv-heading tcv-heading--error">Already claimed</h1>
        <p class="tcv-sub">This transfer link has already been used.</p>
      </template>

      <!-- Expired -->
      <template v-else-if="state === 'expired'">
        <h1 class="tcv-heading tcv-heading--error">Transfer expired</h1>
        <p class="tcv-sub">This claim link has expired. Please ask the sender to initiate a new transfer.</p>
      </template>

      <!-- Invalid token -->
      <template v-else-if="state === 'invalid'">
        <h1 class="tcv-heading tcv-heading--error">Invalid link</h1>
        <p class="tcv-sub">This claim link is not valid.</p>
      </template>

      <!-- Generic error -->
      <template v-else>
        <h1 class="tcv-heading tcv-heading--error">Something went wrong</h1>
        <p v-if="errorMsg" class="tcv-sub">{{ errorMsg }}</p>
        <p v-else class="tcv-sub">Please try again later.</p>
      </template>
    </div>
  </main>
</template>

<style scoped>
.tcv-wrap {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
  min-height: 60vh;
}

.tcv-card {
  width: 100%;
  max-width: 480px;
  border: 1px solid #e5e5e5;
  border-radius: 1rem;
  padding: 2rem;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.tcv-heading {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.tcv-heading--error {
  color: #c00;
}

.tcv-sub {
  font-size: 0.9375rem;
  color: #555;
  margin: 0;
}

.tcv-code {
  font-family: monospace;
  background: #f0f0f0;
  padding: 0.15em 0.35em;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  word-break: break-all;
}

.tcv-msg {
  color: #555;
  font-size: 0.9375rem;
  margin: 0;
}
</style>
