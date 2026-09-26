<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '@/api/client'
import { claimTransfer } from '@/api/fan'
import TicketDownloadCard from '@/components/TicketDownloadCard.vue'
import { useFanLocale } from '@/composables/useFanLocale'

// Fans never see the admin's language switcher, so these pages resolve
// their own locale the way the API does — see utils/fanLocale.ts.
useFanLocale()

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
    if (err instanceof ApiError) {
      // Read the status off the error, not out of its text. The message is
      // now whatever Laravel sent in the fan's own language, so matching on
      // it would break the moment a translation landed.
      if (err.status === 409) {
        state.value = 'already_claimed'
      } else if (err.status === 410) {
        state.value = 'expired'
      } else if (err.status === 404) {
        state.value = 'invalid'
      } else {
        state.value  = 'error'
        errorMsg.value = err.message
      }
    } else if (err instanceof Error) {
      state.value  = 'error'
      errorMsg.value = err.message
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
        {{ $t('fan.claim.claiming') }}
      </p>

      <!-- Success -->
      <template v-else-if="state === 'success'">
        <h1 class="tcv-heading">{{ $t('fan.claim.claimed') }}</h1>
        <p class="tcv-sub">{{ $t('fan.claim.newUuid') }} <code class="tcv-code">{{ newUuid }}</code></p>
        <TicketDownloadCard v-if="newUuid" :uuid="newUuid" />
      </template>

      <!-- Already claimed -->
      <template v-else-if="state === 'already_claimed'">
        <h1 class="tcv-heading tcv-heading--error">{{ $t('fan.claim.alreadyTitle') }}</h1>
        <p class="tcv-sub">{{ $t('fan.claim.alreadyBody') }}</p>
      </template>

      <!-- Expired -->
      <template v-else-if="state === 'expired'">
        <h1 class="tcv-heading tcv-heading--error">{{ $t('fan.claim.expiredTitle') }}</h1>
        <p class="tcv-sub">{{ $t('fan.claim.expiredBody') }}</p>
      </template>

      <!-- Invalid token -->
      <template v-else-if="state === 'invalid'">
        <h1 class="tcv-heading tcv-heading--error">{{ $t('fan.claim.invalidTitle') }}</h1>
        <p class="tcv-sub">{{ $t('fan.claim.invalidBody') }}</p>
      </template>

      <!-- Generic error -->
      <template v-else>
        <h1 class="tcv-heading tcv-heading--error">{{ $t('fan.claim.errorTitle') }}</h1>
        <p v-if="errorMsg" class="tcv-sub">{{ errorMsg }}</p>
        <p v-else class="tcv-sub">{{ $t('fan.claim.errorBody') }}</p>
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
