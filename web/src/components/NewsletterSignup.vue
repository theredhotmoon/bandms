<script setup lang="ts">
import { ref } from 'vue'

/**
 * Copy comes from the caller, as it does for ContactForm, so the island ships one
 * language rather than both. Defaults keep the four existing call sites working
 * without each having to pass every string.
 */
withDefaults(
  defineProps<{
    placeholder?: string
    submitLabel?: string
    sendingLabel?: string
    doneLabel?: string
    errorLabel?: string
  }>(),
  {
    placeholder: 'your@email.com',
    submitLabel: 'Join the list',
    sendingLabel: 'Subscribing…',
    doneLabel: "You're on the list!",
    errorLabel: 'Something went wrong. Please try again.',
  },
)

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
    <p v-if="status === 'sent'" class="ns-done" role="status">
      <span class="ns-done-mark" aria-hidden="true">✦</span>{{ doneLabel }}
    </p>

    <form v-else class="ns-form" @submit.prevent="submit">
      <input
        v-model="email"
        type="email"
        required
        autocomplete="email"
        :placeholder="placeholder"
        class="ns-input"
      />
      <button type="submit" class="ns-btn" :disabled="status === 'sending'">
        {{ status === 'sending' ? sendingLabel : submitLabel }} →
      </button>
    </form>

    <p v-if="status === 'error'" class="ns-error" role="alert">
      {{ errorMsg || errorLabel }}
    </p>
  </div>
</template>

<style scoped>
/* The design's newsletter form: a heavy bordered field with an ink button that
   carries the accent as a hard offset shadow. */
.ns-form { display: flex; flex-direction: column; gap: 12px; }

.ns-input {
  border: var(--border-width-card) solid var(--color-border);
  background: var(--color-surface-2);
  padding: 16px 18px;
  font: 600 17px/1 var(--font-body);
  color: var(--color-body);
  outline: none;
  border-radius: var(--radius-card);
}
.ns-input::placeholder { color: var(--color-subtle); }
.ns-input:focus-visible { box-shadow: 0 0 0 3px var(--color-accent); }

.ns-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  border: none;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 19px;
  line-height: 1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  padding: 16px 26px;
  cursor: pointer;
  box-shadow: 6px 6px 0 var(--color-accent);
}
.ns-btn:disabled { opacity: .6; cursor: default; }

.ns-done {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  color: var(--color-accent);
}
.ns-done-mark { font-size: 22px; }

.ns-error {
  margin: 10px 0 0;
  font: 600 14px/1.4 var(--font-body);
  color: var(--color-danger);
}

@media (max-width: 700px) {
  .ns-done { font-size: 20px; }
  .ns-btn { font-size: 16px; padding: 14px 20px; }
}
</style>
