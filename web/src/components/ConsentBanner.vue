<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useStore } from '@nanostores/vue'
import { consentStatus, denyConsent, grantConsent, loadStoredConsent } from '@/stores/consent'
import { disableGoogleAnalytics, loadGoogleAnalytics } from '@/lib/analytics'
import type { Locale } from '@/types/shared'

interface Props {
  lang: Locale
  measurementId: string
}
const props = defineProps<Props>()

const status = useStore(consentStatus)

const T = {
  en: {
    body: 'We use cookies to understand how visitors use this site. Analytics only load if you accept.',
    accept: 'Accept',
    reject: 'Reject',
    privacy: 'Privacy policy',
  },
  pl: {
    body: 'Używamy plików cookie, aby zrozumieć, jak odwiedzający korzystają z tej strony. Analityka ładuje się tylko po Twojej zgodzie.',
    accept: 'Akceptuję',
    reject: 'Odrzucam',
    privacy: 'Polityka prywatności',
  },
} as const

const t = T[props.lang] ?? T.en
const privacyHref = `/${props.lang}/privacy`

// grant/deny/resetConsent() only persist + flip the atom; starting or
// stopping GA is this component's job, triggered by the same watcher
// whichever way the status changed — including 'unknown', which covers a
// visitor reopening "Cookie settings" after having accepted: consent is
// withdrawn the moment the banner reopens, not only if they go on to click
// Reject, and disableGoogleAnalytics() is safe to call even if GA was never
// loaded in this tab.
watch(status, value => {
  if (value === 'granted') loadGoogleAnalytics(props.measurementId)
  else disableGoogleAnalytics(props.measurementId)
}, { immediate: true })

onMounted(loadStoredConsent)
</script>

<template>
  <div
    v-if="status === 'unknown'"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-4 shadow-card sm:px-6"
    role="region"
    :aria-label="t.privacy"
  >
    <div class="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-muted">
        {{ t.body }}
        <a :href="privacyHref" class="underline hover:text-body">{{ t.privacy }}</a>
      </p>
      <div class="flex flex-none gap-3">
        <button
          type="button"
          class="rounded-card border border-border px-4 py-2 text-sm font-bold text-body transition-colors hover:bg-surface-2"
          @click="denyConsent"
        >
          {{ t.reject }}
        </button>
        <button
          type="button"
          class="rounded-card bg-accent px-4 py-2 text-sm font-bold text-on-accent transition-colors hover:bg-accent-dark"
          @click="grantConsent"
        >
          {{ t.accept }}
        </button>
      </div>
    </div>
  </div>
</template>
