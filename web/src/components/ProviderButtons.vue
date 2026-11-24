<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { rememberReturnPath } from '@/lib/comments'
import { isPlainLeftClick, newProviderClaim, providerName, providerUrl } from '@/lib/fanAuth'

/**
 * "Continue with Google / Facebook", then the "or" divider above the password
 * form. Rendered only for the providers the API has configured.
 *
 * Each button is a real link to the redirect URL without a claim, so it works
 * without JS and on a middle click. A plain left click is taken over to make
 * this browser's claim first (when the sign-in is finished by an emailed link,
 * only the browser holding the claim gets the provider account connected) and
 * to note the post to come back to; a claim that cannot be made still navigates.
 */
export interface ProviderButtonsCopy {
  /** Carries `{provider}`. */
  continueWith: string
  orDivider: string
}

const props = defineProps<{
  providers: string[]
  copy: ProviderButtonsCopy
  lang: string
  /** This post's own path — where the fan comes back to afterwards. */
  returnPath: string
}>()

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

async function go(e: MouseEvent, provider: string) {
  if (!isPlainLeftClick(e)) return
  e.preventDefault()
  if (leaving.value) return
  leaving.value = true
  clearTimeout(timer)
  timer = setTimeout(() => { leaving.value = false }, LEAVE_MS)
  // Neither step may leave a dead button: without a claim the fan still goes.
  let claimHash: string | null = null
  try {
    rememberReturnPath(props.returnPath)
    claimHash = await newProviderClaim()
  } catch {
    claimHash = null
  }
  window.location.assign(providerUrl(provider, props.lang, props.returnPath, claimHash))
}
</script>

<template>
  <div v-if="providers.length > 0" class="pb" data-testid="fan-providers">
    <a
      v-for="p in providers" :key="p"
      :href="providerUrl(p, lang, returnPath, null)" rel="nofollow" class="pb-btn"
      :aria-disabled="leaving ? 'true' : undefined"
      :data-testid="`fan-provider-${p}`" @click="go($event, p)"
    >
      <svg class="pb-mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <template v-if="p === 'google'">
          <path d="M19.5 7.2A8.2 8.2 0 1 0 20.2 12H12.3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="butt" />
        </template>
        <path
          v-else
          d="M14 8.5V6.9c0-.7.2-1.1 1.2-1.1H17V3h-2.6C11.8 3 10.5 4.5 10.5 6.6v1.9H8v3h2.5V21H14v-9.5h2.4l.4-3H14Z"
          fill="currentColor"
        />
      </svg>
      <span>{{ copy.continueWith.replace('{provider}', providerName(p)) }}</span>
    </a>
    <p class="pb-or" role="separator"><span>{{ copy.orDivider }}</span></p>
  </div>
</template>

<style scoped>
.pb { display: flex; flex-direction: column; gap: 8px; }
.pb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-sizing: border-box;
  min-height: 44px;
  padding: 10px 16px;
  border: var(--border-width-card) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-2);
  color: var(--color-body);
  font: 700 15px/1.2 var(--font-body);
  text-decoration: none;
  text-align: center;
}
.pb-btn:hover { background: var(--color-surface); }
.pb-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--color-accent); }
.pb-btn[aria-disabled='true'] { opacity: .6; cursor: default; }
.pb-mark { flex: none; }
.pb-or {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0 0;
  font: 400 13px/1 var(--font-body);
  color: var(--color-muted);
}
.pb-or::before, .pb-or::after { content: ''; flex: 1; border-top: var(--border-width-card) solid var(--color-border); }
</style>
