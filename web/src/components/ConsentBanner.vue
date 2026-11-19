<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStore } from '@nanostores/vue'
import { consentStatus, denyConsent, grantConsent, loadStoredConsent, type ConsentStatus } from '@/stores/consent'
import { disableGoogleAnalytics, loadGoogleAnalytics } from '@/lib/analytics'
import { isExcludedPath, storageWritable } from '@/lib/welcome'
import { trapTab } from '@/lib/trapTab'
import type { Locale } from '@/types/shared'

/** Labels from the Privacy module's copy — see BaseLayout.astro. */
export interface ConsentCopy {
  title: string
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

// Which layout is decided in the browser, after mount: SSR cannot know the
// path-dependent choice without a hydration mismatch, so it renders nothing
// and the card/strip appears with the stored answer. Teleport is gated on the
// same flag — see ModalShell.vue's header comment, it is load-bearing.
const mounted = ref(false)
const strip = ref(false)
const showCard = computed(() => mounted.value && !strip.value && status.value === 'unknown')
const showStrip = computed(() => mounted.value && strip.value && status.value === 'unknown')
const card = ref<HTMLElement | null>(null)

// The card cannot be dismissed without an answer: Esc is ignored and Tab
// cycles inside it, wherever focus happened to be (a click on the backdrop
// leaves it on <body>).
function onKeydown(e: KeyboardEvent): void {
  if (card.value) trapTab(card.value, e)
}

watch(showCard, async open => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    card.value?.focus()
  } else {
    document.removeEventListener('keydown', onKeydown)
  }
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

// A choice that cannot be stored is asked for again on every page, so the
// blocking card would trap a private-window visitor page after page: they get
// the non-blocking strip instead.
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

onMounted(() => {
  strip.value = isExcludedPath(window.location.pathname) || !storageWritable(browserStorage())
  mounted.value = true
  loadStoredConsent()
  // Also when the answer is still 'unknown': an Accept that has expired
  // leaves cookies behind that nobody has agreed to any more.
  applyConsent(consentStatus.get())
})
</script>

<template>
  <div
    v-if="showStrip"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-4 shadow-card sm:px-6"
    role="region"
    :aria-label="t.privacy"
  >
    <div class="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-muted">
        {{ t.body }}
        <a v-if="privacyHref" :href="privacyHref" class="underline hover:text-body">{{ t.privacy }}</a>
      </p>
      <!-- Equal columns, same order as the card: neither answer is the bigger button. -->
      <div class="consent-strip-actions">
        <button type="button" class="consent-btn" data-testid="consent-allow" @click="grantConsent">{{ t.accept }}</button>
        <button type="button" class="consent-btn" data-testid="consent-reject" @click="denyConsent">{{ t.reject }}</button>
      </div>
    </div>
  </div>

  <Teleport v-if="showCard" to="body">
    <div class="consent-scrim">
      <div
        ref="card"
        class="consent-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        tabindex="-1"
      >
        <h2 id="consent-title" class="consent-title">{{ t.title }}</h2>
        <p class="consent-body">{{ t.body }}</p>
        <a v-if="privacyHref" :href="privacyHref" class="consent-link">{{ t.privacy }}</a>
        <div class="consent-actions">
          <button type="button" class="consent-btn" data-testid="consent-allow" @click="grantConsent">{{ t.accept }}</button>
          <button type="button" class="consent-btn" data-testid="consent-reject" @click="denyConsent">{{ t.reject }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* Unscoped: the card is teleported to <body>, and the strip shares the button. */
.consent-btn {
  min-width: 7.5rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-body);
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.25;
  cursor: pointer;
  transition: background-color 0.15s;
}
.consent-btn:hover { background: var(--color-surface-2); }
.consent-btn:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.consent-scrim {
  position: fixed;
  inset: 0;
  z-index: 230;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in oklab, var(--color-ink) 76%, transparent);
}
.consent-card {
  width: 100%;
  max-width: 28rem;
  background: var(--color-page);
  color: var(--color-body);
  border: 3px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 1.5rem;
  outline: none;
  animation: consent-in 0.2s ease-out;
}
.consent-title {
  font: var(--display-weight) 1.5rem/1.1 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  margin: 0 0 0.75rem;
}
.consent-body { margin: 0 0 0.5rem; font-size: 0.9375rem; color: var(--color-muted); }
.consent-link { font-size: 0.875rem; text-decoration: underline; color: var(--color-body); }
.consent-link:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }
.consent-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
.consent-actions .consent-btn { flex: 1 1 0; }
.consent-strip-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; flex: none; width: 100%; }
@media (min-width: 640px) { .consent-strip-actions { width: auto; } }

@keyframes consent-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .consent-card { animation: none; }
  .consent-btn { transition: none; }
}
</style>
