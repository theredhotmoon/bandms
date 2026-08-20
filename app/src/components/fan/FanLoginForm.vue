<script setup lang="ts">
import { ref } from 'vue'
import { requestMagicLink } from '@/api/fan'
import { ApiValidationError } from '@/api/client'

const emit = defineEmits<{
  'magic-link-sent': [devLink: string]
}>()

const email = ref('')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

async function handleSubmit() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const result = await requestMagicLink(email.value)
    emit('magic-link-sent', result.dev_link)
  } catch (err) {
    if (err instanceof ApiValidationError) {
      errorMessage.value = Object.values(err.errors).flat().join(' ')
    } else {
      errorMessage.value = err instanceof Error ? err.message : 'Something went wrong.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flf-card">
    <h1>My Account</h1>
    <p>Enter your email to receive a magic sign-in link.</p>
    <form @submit.prevent="handleSubmit" class="flf-form">
      <label for="fan-email" class="flf-label">Email address</label>
      <input
        id="fan-email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        required
        class="flf-input"
        :disabled="isLoading"
      />
      <p v-if="errorMessage" class="flf-error" role="alert">{{ errorMessage }}</p>
      <button type="submit" class="flf-btn" :disabled="isLoading">
        {{ isLoading ? 'Sending…' : 'Send magic link' }}
      </button>
    </form>
  </div>
</template>
