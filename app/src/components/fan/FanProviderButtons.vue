<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { providerName, providerUrl } from '@/utils/authQuery'
import { browserStore, newProviderClaim } from '@/utils/fanClaim'
import { chosenFanLocale, readStoredFanLocale } from '@/utils/fanLocale'
import { isPlainLeftClick } from '@/utils/plainClick'

/**
 * "Continue with Google / Facebook" and the "or" divider above the password
 * form. Real links (no JS needed, middle click works); a plain left click first
 * makes this browser's claim: when the sign-in is finished by an emailed link,
 * only the browser holding it gets the provider account connected. There is no
 * post to return to here, so no `return_to`: the callback ends on /account.
 */
defineProps<{ providers: string[] }>()

const { t } = useI18n()
// Set by a click; cleared when the page is still here after all: shown again
// from the back/forward cache, or the navigation was stopped, which nothing reports.
const LEAVE_MS = 5000
const leaving = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function onShow(e: PageTransitionEvent) {
  if (e.persisted) leaving.value = false
}
onMounted(() => window.addEventListener('pageshow', onShow))
onBeforeUnmount(() => {
  window.removeEventListener('pageshow', onShow)
  clearTimeout(timer)
})

function href(provider: string, claimHash: string | null): string {
  const lang = chosenFanLocale({ search: window.location.search, stored: readStoredFanLocale() })
  return providerUrl(provider, lang, null, claimHash)
}

async function go(e: MouseEvent, provider: string) {
  if (!isPlainLeftClick(e)) return
  e.preventDefault()
  if (leaving.value) return
  leaving.value = true
  clearTimeout(timer)
  timer = setTimeout(() => { leaving.value = false }, LEAVE_MS)
  // A failure here must not leave a dead button: without a claim the fan still goes.
  let claimHash: string | null = null
  try {
    claimHash = await newProviderClaim(browserStore())
  } catch {
    claimHash = null
  }
  window.location.assign(href(provider, claimHash))
}
</script>

<template>
  <div v-if="providers.length > 0" class="fpb" data-testid="fan-providers">
    <a
      v-for="p in providers"
      :key="p"
      :href="href(p, null)"
      rel="nofollow"
      class="fan-btn fan-btn--quiet fpb-btn"
      :aria-disabled="leaving ? 'true' : undefined"
      :data-testid="`fan-provider-${p}`"
      @click="go($event, p)"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          v-if="p === 'google'"
          d="M19.5 7.2A8.2 8.2 0 1 0 20.2 12H12.3"
          fill="none" stroke="currentColor" stroke-width="2.6"
        />
        <path
          v-else
          d="M14 8.5V6.9c0-.7.2-1.1 1.2-1.1H17V3h-2.6C11.8 3 10.5 4.5 10.5 6.6v1.9H8v3h2.5V21H14v-9.5h2.4l.4-3H14Z"
          fill="currentColor"
        />
      </svg>
      <span>{{ t('fan.login.continueWith', { provider: providerName(p) }) }}</span>
    </a>
    <p class="fan-hint fpb-or" role="separator"><span>{{ t('fan.login.or') }}</span></p>
  </div>
</template>

<style scoped src="./fan-styles.css" />
<style scoped>
.fpb { display: flex; flex-direction: column; gap: 0.5rem; }
.fpb-btn {
  display: flex; align-items: center; justify-content: center; gap: 0.625rem;
  text-decoration: none; text-align: center;
}
.fpb-btn svg { flex: none; }
.fpb-btn[aria-disabled='true'] { opacity: 0.6; cursor: default; }
.fpb-or { display: flex; align-items: center; gap: 0.75rem; margin: 0.5rem 0 0; }
.fpb-or::before, .fpb-or::after { content: ''; flex: 1; border-top: 1px solid currentColor; opacity: 0.4; }
</style>
