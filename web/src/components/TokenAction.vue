<script setup lang="ts">
import { ref, onMounted } from 'vue'

type ActionType = 'confirm' | 'unsubscribe'

const props = defineProps<{ action: ActionType }>()

const status = ref<'loading' | 'success' | 'error'>('loading')
const message = ref('')

const MESSAGES: Record<ActionType, { success: string; error: string }> = {
  confirm: {
    success: 'Your email has been confirmed. Welcome to the list!',
    error:   'This confirmation link is invalid or has already been used.',
  },
  unsubscribe: {
    success: 'You have been successfully unsubscribed.',
    error:   'This unsubscribe link is invalid or has already been used.',
  },
}

const API_PATHS: Record<ActionType, (token: string) => string> = {
  confirm:     (t) => `/api/newsletter/confirm/${encodeURIComponent(t)}`,
  unsubscribe: (t) => `/api/newsletter/unsubscribe/${encodeURIComponent(t)}`,
}

onMounted(async () => {
  // Extract token from URL path — the nginx catch-all serves this page
  // for any sub-path of /newsletter/confirm/ or /newsletter/unsubscribe/
  const parts = window.location.pathname.split('/').filter(Boolean)
  const token = parts[parts.length - 1] ?? ''

  if (!token || token === 'confirm' || token === 'unsubscribe') {
    status.value = 'error'
    message.value = MESSAGES[props.action].error
    return
  }

  try {
    const res = await fetch(API_PATHS[props.action](token), {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      status.value = 'success'
      message.value = MESSAGES[props.action].success
    } else {
      status.value = 'error'
      message.value = MESSAGES[props.action].error
    }
  } catch {
    status.value = 'error'
    message.value = 'Network error. Please try again.'
  }
})
</script>

<template>
  <div class="text-center py-16 px-4">
    <!-- Loading -->
    <div v-if="status === 'loading'" class="flex flex-col items-center gap-4">
      <div class="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-accent animate-spin" />
      <p class="text-zinc-400">Please wait…</p>
    </div>

    <!-- Success -->
    <div v-else-if="status === 'success'" class="flex flex-col items-center gap-4">
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30 text-green-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <p class="text-xl font-semibold text-white">{{ message }}</p>
      <a href="/" class="text-accent hover:underline text-sm">← Back to home</a>
    </div>

    <!-- Error -->
    <div v-else class="flex flex-col items-center gap-4">
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30 text-red-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <p class="text-xl font-semibold text-white">{{ message }}</p>
      <a href="/newsletter" class="text-accent hover:underline text-sm">Go to newsletter page</a>
    </div>
  </div>
</template>
