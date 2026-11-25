<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { rememberReturnPath, requestSignInLink, type FanSession } from '@/lib/comments'
import { fanAuthErrorText, fetchProviders, registerWithPassword, signInWithPassword } from '@/lib/fanAuth'
import ProviderButtons from './ProviderButtons.vue'

/**
 * The signed-out block under a news post: email + password, creating an
 * account, or an emailed link. One email field serves all three; the password
 * is cleared whenever the mode changes or an action succeeds.
 *
 * Copy arrives as a prop (an island has no siteConfig); see postCommentsCopy()
 * in lib/copy.ts.
 */
export interface FanSignInCopy {
  lead: string
  emailLabel: string
  passwordLabel: string
  signIn: string
  signingIn: string
  emailLinkInstead: string
  sendingLink: string
  createAccount: string
  createAccountSubmit: string
  creatingAccount: string
  backToSignIn: string
  linkSent: string
  registerSent: string
  loginFailed: string
  loginLimit: string
  passwordHint: string
  failed: string
  /** Carries `{provider}`. */
  continueWith: string
  orDivider: string
}

const props = defineProps<{
  copy: FanSignInCopy
  lang: string
  /** This post's own path — where an emailed link brings the fan back to. */
  returnPath: string
}>()

const emit = defineEmits<{ 'signed-in': [session: FanSession] }>()

const mode = ref<'signin' | 'register'>('signin')
const email = ref('')
const password = ref('')
// Which request is under way, so only its own button says so.
const inFlight = ref<'signin' | 'register' | 'link' | null>(null)
const busy = computed(() => inFlight.value !== null)
const notice = ref('')
const error = ref('')
const emailInput = ref<HTMLInputElement | null>(null)

// Which provider buttons to offer. Asked once, in the browser, and never waited
// for: the form is complete without them. An answer after unmount is dropped.
const providers = ref<string[]>([])
let gone = false
onMounted(async () => {
  const found = await fetchProviders(props.lang)
  if (!gone) providers.value = found
})
onBeforeUnmount(() => { gone = true })

function setMode(next: 'signin' | 'register') {
  mode.value = next
  password.value = ''
  error.value = ''
}

async function submit() {
  if (busy.value) return
  error.value = ''
  inFlight.value = mode.value
  try {
    if (mode.value === 'signin') {
      const session = await signInWithPassword(email.value, password.value, props.lang)
      password.value = ''
      emit('signed-in', session)
    } else {
      await registerWithPassword(email.value, password.value, props.lang, props.returnPath)
      // The account page only follows the link's return path in the browser
      // that asked for it — see rememberReturnPath().
      rememberReturnPath(props.returnPath)
      password.value = ''
      notice.value = props.copy.registerSent
    }
  } catch (e) {
    error.value = fanAuthErrorText(e, props.copy)
  } finally {
    inFlight.value = null
  }
}

async function sendLink() {
  // A type="button" skips the form's validation, and the password field's
  // `required` must not apply here anyway: check the email on its own.
  if (busy.value || !emailInput.value?.reportValidity()) return
  error.value = ''
  inFlight.value = 'link'
  try {
    await requestSignInLink(email.value, props.lang, props.returnPath)
    rememberReturnPath(props.returnPath)
    password.value = ''
    notice.value = props.copy.linkSent
  } catch (e) {
    error.value = fanAuthErrorText(e, props.copy)
  } finally {
    inFlight.value = null
  }
}
</script>

<template>
  <div class="fs" data-testid="fan-signin">
    <p v-if="notice" class="fs-notice" role="status" aria-live="polite" data-testid="fan-signin-notice">{{ notice }}</p>

    <form v-else class="fs-form" @submit.prevent="submit">
      <p class="fs-lead">{{ copy.lead }}</p>

      <ProviderButtons :providers="providers" :copy="copy" :lang="lang" :return-path="returnPath" />

      <label class="fs-label" for="fs-email">{{ copy.emailLabel }}</label>
      <input
        id="fs-email" ref="emailInput" v-model="email" type="email" required autocomplete="email"
        class="fs-input" data-testid="fan-signin-email"
      />

      <label class="fs-label" for="fs-password">{{ copy.passwordLabel }}</label>
      <input
        id="fs-password" v-model="password" type="password" required
        :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
        :minlength="mode === 'register' ? 8 : undefined"
        :aria-describedby="mode === 'register' ? 'fs-hint' : undefined"
        class="fs-input" data-testid="fan-signin-password"
      />
      <p v-if="mode === 'register'" id="fs-hint" class="fs-hint">{{ copy.passwordHint }}</p>

      <div class="fs-row">
        <button type="submit" class="fs-btn" :disabled="busy" data-testid="fan-signin-submit">
          <template v-if="inFlight === 'signin'">{{ copy.signingIn }}</template>
          <template v-else-if="inFlight === 'register'">{{ copy.creatingAccount }}</template>
          <template v-else-if="mode === 'register'">{{ copy.createAccountSubmit }}</template>
          <template v-else>{{ copy.signIn }}</template>
        </button>
        <button
          type="button" class="fs-link" :disabled="busy" data-testid="fan-signin-register"
          @click="setMode(mode === 'register' ? 'signin' : 'register')"
        >
          {{ mode === 'register' ? copy.backToSignIn : copy.createAccount }}
        </button>
      </div>

      <button type="button" class="fs-link fs-linkonly" :disabled="busy" data-testid="fan-signin-link" @click="sendLink">
        {{ inFlight === 'link' ? copy.sendingLink : copy.emailLinkInstead }}
      </button>
    </form>

    <p v-if="error" class="fs-error" role="alert" data-testid="fan-signin-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.fs-form { display: flex; flex-direction: column; gap: 8px; }
.fs-lead { margin: 0 0 4px; font: 400 16px/1.5 var(--font-body); color: var(--color-body); }
.fs-label { font: 700 14px/1.3 var(--font-body); color: var(--color-body); }
.fs-hint { margin: 0; font: 400 13px/1.4 var(--font-body); color: var(--color-muted); }

.fs-input {
  width: 100%;
  box-sizing: border-box;
  border: var(--border-width-card) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-2);
  padding: 12px 14px;
  font: 400 16px/1.4 var(--font-body);
  color: var(--color-body);
  outline: none;
}
.fs-input:focus-visible { box-shadow: 0 0 0 3px var(--color-accent); }

.fs-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-top: 4px; }

.fs-btn {
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  border: none;
  border-radius: var(--radius-card);
  font: 700 16px/1 var(--font-body);
  padding: 14px 20px;
  cursor: pointer;
}
.fs-btn:focus-visible { box-shadow: 0 0 0 3px var(--color-accent); outline: none; }
.fs-btn:disabled { opacity: .6; cursor: default; }

.fs-link {
  background: none;
  border: none;
  padding: 4px 0;
  font: 400 14px/1.3 var(--font-body);
  color: var(--color-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  text-align: start;
}
.fs-link:hover { color: var(--color-body); }
.fs-link:focus-visible { color: var(--color-body); box-shadow: 0 0 0 3px var(--color-accent); outline: none; }
.fs-link:disabled { opacity: .6; cursor: default; }
.fs-linkonly { align-self: flex-start; }

.fs-notice { margin: 0; font: 400 16px/1.5 var(--font-body); color: var(--color-body); }
.fs-error { margin: 12px 0 0; font: 700 15px/1.4 var(--font-body); color: var(--color-danger); }
</style>
