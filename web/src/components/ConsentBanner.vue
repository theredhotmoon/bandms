<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useStore } from '@nanostores/vue'
import { consentStatus, denyConsent, grantConsent, loadStoredConsent, type ConsentStatus } from '@/stores/consent'
import { disableGoogleAnalytics, loadGoogleAnalytics } from '@/lib/analytics'
import type { Locale } from '@/types/shared'

/** Labels from the Privacy module's copy — see BaseLayout.astro. */
export interface ConsentCopy {
  body: string
  accept: string
  reject: string
  privacy: string
}

interface Props {
  lang: Locale
  measurementId: string
  copy: ConsentCopy
  /** Null when the privacy page is switched off — the link is then omitted. */
  privacyHref: string | null
}
const props = defineProps<Props>()

const status = useStore(consentStatus)

const t = props.copy

// grant/deny/resetConsent() only persist + flip the atom; starting or
// stopping GA is this component's job, whichever way the status changed —
// including back to 'unknown', which covers a visitor reopening "Cookie
// settings" after having accepted: consent is withdrawn the moment the banner
// reopens, not only if they go on to click Reject.
function applyConsent(value: ConsentStatus): void {
  if (value === 'granted') loadGoogleAnalytics(props.measurementId)
  else disableGoogleAnalytics(props.measurementId)
}

// Not `immediate`. The atom starts at 'unknown' on every page load, before
// the stored choice has been read, and that placeholder is not a withdrawal:
// acting on it set GA's kill switch on every page (the tag then never sent a
// hit) and cleared the visitor's `_ga` cookies, which would make each page
// view a new visitor. Read the stored choice first, then act on it once.
watch(status, applyConsent)

onMounted(() => {
  loadStoredConsent()
  // Also when the answer is still 'unknown': an Accept that has expired
  // leaves cookies behind that nobody has agreed to any more.
  applyConsent(consentStatus.get())
})
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
        <a v-if="privacyHref" :href="privacyHref" class="underline hover:text-body">{{ t.privacy }}</a>
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
