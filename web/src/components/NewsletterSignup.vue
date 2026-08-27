<script setup lang="ts">
import { ref } from 'vue'

const email  = ref('')
const status = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const errorMsg = ref('')

async function submit() {
  if (status.value === 'sending' || !email.value) return
  status.value = 'sending'
  errorMsg.value = ''
  try {
    const res = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: email.value }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { message?: string }
      throw new Error(data.message ?? 'Something went wrong')
    }
    status.value = 'sent'
  } catch (e) {
    status.value = 'error'
    errorMsg.value = e instanceof Error ? e.message : 'Something went wrong'
  }
}
</script>

<template>
  <div>
    <div v-if="status === 'sent'" class="rounded-card border border-success bg-success-subtle p-4 text-center">
      <p class="font-semibold text-success">You're in! 🎉</p>
      <p class="mt-1 text-sm text-muted">Check your inbox to confirm your subscription.</p>
    </div>

    <form v-else @submit.prevent="submit" class="flex gap-2 flex-col sm:flex-row">
      <input
        v-model="email"
        type="email"
        required
        autocomplete="email"
        placeholder="your@email.com"
        class="flex-1 rounded-card border border-border bg-surface-2 px-3 py-2.5 text-sm text-body placeholder-subtle focus:border-accent focus:outline-none transition-colors"
      />
      <button
        type="submit"
        :disabled="status === 'sending'"
        class="rounded-card bg-accent px-5 py-2.5 text-sm font-bold text-on-accent hover:bg-accent-dark disabled:opacity-60 transition-colors whitespace-nowrap"
      >
        {{ status === 'sending' ? 'Subscribing…' : 'Subscribe' }}
      </button>
    </form>

    <p v-if="status === 'error'" class="mt-2 text-sm text-danger">
      {{ errorMsg || 'Something went wrong. Please try again.' }}
    </p>
  </div>
</template>
