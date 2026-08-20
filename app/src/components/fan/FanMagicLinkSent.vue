<script setup lang="ts">
import { ref } from 'vue'
import { verifyMagicLink } from '@/api/fan'
import { useFanAccount } from '@/composables/useFanAccount'

const props = defineProps<{ devLink: string }>()
const { setSession } = useFanAccount()

const errorMessage = ref<string | null>(null)

// Extract token from devLink and allow clicking
async function handleVerify() {
  errorMessage.value = null
  try {
    const url = new URL(props.devLink)
    const token = url.searchParams.get('token') ?? ''
    const result = await verifyMagicLink(token)
    setSession(result.token, result.fan)
  } catch {
    errorMessage.value = 'Sign-in link invalid or expired. Please request a new one.'
  }
}
</script>

<template>
  <div class="fmls-card">
    <h2>Check your email</h2>
    <p>We sent a magic link to your email address.</p>
    <p class="fmls-dev">
      <strong>Dev mode:</strong>
      <a :href="devLink" @click.prevent="handleVerify" class="fmls-link">Click here to sign in</a>
    </p>
    <p v-if="errorMessage" role="alert" class="fmls-error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.fmls-error {
  color: #dc2626;
  margin-top: 0.5rem;
  font-size: 0.875rem;
}
</style>
