<script setup lang="ts">
import { ref } from 'vue'
import { subscribeToNewsletter } from '@/api/newsletter'

const props = withDefaults(defineProps<{
  source?: string
  title?: string
  subtitle?: string
  compact?: boolean
}>(), {
  source:   'website',
  title:    'Stay in the loop',
  subtitle: 'Get notified about new shows, releases and news.',
  compact:  false,
})

const email = ref('')
const name  = ref('')
const state = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const errorMsg = ref('')

async function submit() {
  if (!email.value.trim() || state.value === 'loading') return
  state.value = 'loading'
  errorMsg.value = ''
  try {
    await subscribeToNewsletter({
      email:  email.value.trim(),
      name:   name.value.trim() || undefined,
      source: props.source,
    })
    state.value = 'success'
  } catch (e) {
    state.value = 'error'
    errorMsg.value = e instanceof Error ? e.message : 'Something went wrong.'
  }
}
</script>

<template>
  <div class="nl-wrap" :class="{ 'nl-wrap--compact': compact }">
    <div v-if="state === 'success'" class="nl-success">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>You're subscribed — thanks!</span>
    </div>

    <template v-else>
      <div v-if="!compact" class="nl-header">
        <p class="nl-eyebrow">Newsletter</p>
        <h3 class="nl-title">{{ title }}</h3>
        <p class="nl-sub">{{ subtitle }}</p>
      </div>

      <form class="nl-form" @submit.prevent="submit">
        <div v-if="!compact" class="nl-field">
          <input
            v-model="name"
            type="text"
            class="nl-input"
            placeholder="Your name (optional)"
            autocomplete="name"
          />
        </div>
        <div class="nl-inline-row">
          <input
            v-model="email"
            type="email"
            class="nl-input"
            placeholder="your@email.com"
            required
            autocomplete="email"
          />
          <button type="submit" class="nl-btn" :disabled="state === 'loading'">
            <span v-if="state === 'loading'">…</span>
            <span v-else>Subscribe</span>
          </button>
        </div>
        <p v-if="state === 'error'" class="nl-error">{{ errorMsg }}</p>
      </form>
    </template>
  </div>
</template>

<style scoped>
.nl-wrap {
  background: #f9f9f9;
  border: 1px solid #e8e8e8;
  border-radius: 1rem;
  padding: 2rem;
}
.nl-wrap--compact {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
}

.nl-success {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: #166534;
  font-size: 0.9375rem;
  font-weight: 600;
}

.nl-header { margin-bottom: 1.25rem; }
.nl-eyebrow {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: #888; margin-bottom: 0.375rem;
}
.nl-title { font-size: 1.125rem; font-weight: 700; color: #111; margin-bottom: 0.25rem; }
.nl-sub   { font-size: 0.875rem; color: #666; line-height: 1.5; }

.nl-form { display: flex; flex-direction: column; gap: 0.625rem; }

.nl-field { display: flex; }

.nl-inline-row { display: flex; gap: 0.5rem; }

.nl-input {
  flex: 1;
  padding: 0.5625rem 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid #ddd;
  background: #fff;
  color: #111;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 150ms;
  min-width: 0;
}
.nl-input:focus { border-color: #888; }

.nl-btn {
  padding: 0.5625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  background: #111;
  color: #fff;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background 150ms;
  flex-shrink: 0;
}
.nl-btn:hover:not(:disabled) { background: #333; }
.nl-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.nl-error {
  font-size: 0.8rem;
  color: #c0392b;
  margin: 0;
}
</style>
