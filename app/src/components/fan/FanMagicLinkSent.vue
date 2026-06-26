<script setup lang="ts">
import { verifyMagicLink } from '@/api/fan'
import { useFanAccount } from '@/composables/useFanAccount'

const props = defineProps<{ devLink: string }>()
const { setSession } = useFanAccount()

// Extract token from devLink and allow clicking
async function handleVerify() {
  const url = new URL(props.devLink)
  const token = url.searchParams.get('token') ?? ''
  const result = await verifyMagicLink(token)
  setSession(result.token, result.fan)
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
  </div>
</template>
