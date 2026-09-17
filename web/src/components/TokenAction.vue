<script setup lang="ts">
import { ref, onMounted } from 'vue'

type ActionType = 'confirm' | 'unsubscribe'

/** Labels from the Newsletter module's copy — see the token pages. */
export interface TokenActionCopy {
  waiting: string
  confirmSuccess: string
  confirmError: string
  unsubscribeSuccess: string
  unsubscribeError: string
  networkError: string
  backHome: string
  goToNewsletter: string
}

const props = defineProps<{ action: ActionType; copy: TokenActionCopy; homeHref: string; newsletterHref: string }>()

const status = ref<'loading' | 'success' | 'error'>('loading')
const message = ref('')

const MESSAGES: Record<ActionType, { success: string; error: string }> = {
  confirm:     { success: props.copy.confirmSuccess,     error: props.copy.confirmError },
  unsubscribe: { success: props.copy.unsubscribeSuccess, error: props.copy.unsubscribeError },
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
    message.value = props.copy.networkError
  }
})
</script>

<template>
  <div class="text-center py-16 px-4">
    <!-- Loading -->
    <div v-if="status === 'loading'" class="flex flex-col items-center gap-4">
      <div class="w-10 h-10 rounded-pill border-2 border-border border-t-accent animate-spin" />
      <p class="text-muted">{{ copy.waiting }}</p>
    </div>

    <!-- Success -->
    <div v-else-if="status === 'success'" class="flex flex-col items-center gap-4">
      <div class="flex h-16 w-16 items-center justify-center rounded-pill bg-success-subtle text-success">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <p class="text-xl font-semibold text-body">{{ message }}</p>
      <a :href="homeHref" class="text-accent hover:underline text-sm">{{ copy.backHome }}</a>
    </div>

    <!-- Error -->
    <div v-else class="flex flex-col items-center gap-4">
      <div class="flex h-16 w-16 items-center justify-center rounded-pill bg-danger-subtle text-danger">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <p class="text-xl font-semibold text-body">{{ message }}</p>
      <a :href="newsletterHref" class="text-accent hover:underline text-sm">{{ copy.goToNewsletter }}</a>
    </div>
  </div>
</template>
