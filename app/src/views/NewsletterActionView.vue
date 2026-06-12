<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { confirmNewsletterSubscription, unsubscribeFromNewsletter } from '@/api/newsletter'

const props = defineProps<{
  action: 'confirm' | 'unsubscribe'
}>()

const route  = useRoute()
const status = ref<'loading' | 'success' | 'error'>('loading')
const message = ref('')

onMounted(async () => {
  const token = route.params.token
  if (!token || typeof token !== 'string') {
    status.value  = 'error'
    message.value = 'Invalid link.'
    return
  }

  try {
    if (props.action === 'confirm') {
      await confirmNewsletterSubscription(token)
      message.value = 'Your subscription is confirmed — welcome!'
    } else {
      await unsubscribeFromNewsletter(token)
      message.value = "You've been unsubscribed. You won't receive any more emails from us."
    }
    status.value = 'success'
  } catch (e) {
    status.value  = 'error'
    message.value = e instanceof Error
      ? e.message
      : (props.action === 'confirm' ? 'This confirmation link is invalid or has already been used.' : 'Invalid unsubscribe link.')
  }
})
</script>

<template>
  <main class="action-page">
    <div class="action-card">
      <div v-if="status === 'loading'" class="action-loading">
        <div class="spinner" />
        <p>{{ action === 'confirm' ? 'Confirming your subscription…' : 'Unsubscribing…' }}</p>
      </div>

      <div v-else-if="status === 'success'" class="action-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="40" height="40" class="action-icon action-icon--success">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <h1 class="action-title">{{ action === 'confirm' ? 'Confirmed!' : 'Unsubscribed' }}</h1>
        <p class="action-message">{{ message }}</p>
        <a href="/" class="action-link">← Back to home</a>
      </div>

      <div v-else class="action-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="40" height="40" class="action-icon action-icon--error">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h1 class="action-title">Something went wrong</h1>
        <p class="action-message">{{ message }}</p>
        <a href="/" class="action-link">← Back to home</a>
      </div>
    </div>
  </main>
</template>

<style scoped>
.action-page {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
}

.action-card {
  width: 100%;
  max-width: 420px;
  text-align: center;
}

.action-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #555;
}

.spinner {
  width: 32px; height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #111;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.action-success,
.action-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.action-icon { margin-bottom: 0.25rem; }
.action-icon--success { color: #166534; }
.action-icon--error   { color: #b91c1c; }

.action-title {
  font-size: 1.625rem;
  font-weight: 800;
  color: #111;
  margin: 0;
  letter-spacing: -0.02em;
}

.action-message {
  font-size: 0.9375rem;
  color: #555;
  line-height: 1.6;
  margin: 0;
}

.action-link {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: #888;
  text-decoration: none;
  transition: color 150ms;
}
.action-link:hover { color: #111; }
</style>
