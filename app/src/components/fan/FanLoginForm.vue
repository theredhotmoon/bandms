<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchFanProviders, loginFan, registerFan, requestMagicLink, type VerifyResponse } from '@/api/fan'
import FanProviderButtons from '@/components/fan/FanProviderButtons.vue'
import { fanErrorMessage, serverRefused } from '@/utils/fanErrors'
import { browserStore, withNewClaim } from '@/utils/fanClaim'

const { t } = useI18n()

const emit = defineEmits<{
  'magic-link-sent': [devLink: string | null]
  'signed-in': [result: VerifyResponse]
  /** Signing in or registering with a password has begun. */
  attempt: []
}>()

type Mode = 'signin' | 'register'
type Action = 'signin' | 'register' | 'link'

// One email field serves all three actions. The password is cleared whenever
// the mode changes or an action succeeds.
const mode = ref<Mode>('signin')
const email = ref('')
const password = ref('')
const emailInput = ref<HTMLInputElement | null>(null)
const inFlight = ref<Action | null>(null)
const errorMessage = ref<string | null>(null)
const notice = ref<string | null>(null)

// Asked once and never waited for: the form is complete without the buttons,
// and an answer that arrives after the form is gone is dropped.
const providers = ref<string[]>([])
let gone = false
onMounted(async () => {
  const found = await fetchFanProviders()
  if (!gone) providers.value = found
})
onBeforeUnmount(() => { gone = true })

function setMode(next: Mode) {
  mode.value = next
  password.value = ''
  errorMessage.value = null
}

async function run(action: Action, work: () => Promise<void>) {
  if (inFlight.value) return
  inFlight.value = action
  errorMessage.value = null
  try {
    await work()
    password.value = ''
  } catch (err) {
    errorMessage.value = fanErrorMessage(err, t('fan.login.failed'))
  } finally {
    inFlight.value = null
  }
}

function handleSubmit() {
  if (inFlight.value) return
  emit('attempt')
  if (mode.value === 'signin') {
    return run('signin', async () => {
      emit('signed-in', await loginFan(email.value, password.value))
    })
  }
  return run('register', async () => {
    // The claim ties the emailed link to this browser; without one (storage or
    // crypto unavailable) the account is still created, just not auto-linked.
    await withNewClaim(
      browserStore(),
      (claimHash) => registerFan(email.value, password.value, claimHash),
      serverRefused,
    )
    notice.value = t('fan.login.registerSent')
  })
}

function handleLink() {
  // type="button" skips the form's validation, and the password's `required`
  // must not apply here anyway: check the email on its own.
  if (inFlight.value || !emailInput.value?.reportValidity()) return
  return run('link', async () => {
    const result = await requestMagicLink(email.value)
    emit('magic-link-sent', result.dev_link ?? null)
  })
}
</script>

<template>
  <div class="fan-card flf" data-testid="fan-login">
    <h1 class="fan-title">{{ $t('fan.login.title') }}</h1>

    <p v-if="notice" class="fan-msg" role="status" aria-live="polite" data-testid="fan-login-notice">{{ notice }}</p>

    <form v-else class="fan-form" @submit.prevent="handleSubmit">
      <p class="fan-text">{{ $t('fan.login.lead') }}</p>

      <FanProviderButtons :providers="providers" />

      <div class="fan-field">
        <label for="fan-email" class="fan-label">{{ $t('fan.login.email') }}</label>
        <input
          id="fan-email"
          ref="emailInput"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          required
          class="fan-input"
          :disabled="inFlight !== null"
          data-testid="fan-login-email"
        />
      </div>

      <div class="fan-field">
        <label for="fan-password" class="fan-label">{{ $t('fan.login.password') }}</label>
        <input
          id="fan-password"
          v-model="password"
          type="password"
          name="password"
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          :minlength="mode === 'register' ? 8 : undefined"
          :aria-describedby="mode === 'register' ? 'fan-password-hint' : undefined"
          required
          class="fan-input"
          :disabled="inFlight !== null"
          data-testid="fan-login-password"
        />
        <p v-if="mode === 'register'" id="fan-password-hint" class="fan-hint">{{ $t('fan.login.passwordHint') }}</p>
      </div>

      <p v-if="errorMessage" class="fan-msg fan-msg--error" role="alert" data-testid="fan-login-error">{{ errorMessage }}</p>

      <div class="flf-actions">
        <button type="submit" class="fan-btn" :disabled="inFlight !== null" data-testid="fan-login-submit">
          <template v-if="inFlight === 'signin'">{{ $t('fan.login.signingIn') }}</template>
          <template v-else-if="inFlight === 'register'">{{ $t('fan.login.creating') }}</template>
          <template v-else-if="mode === 'register'">{{ $t('fan.login.createSubmit') }}</template>
          <template v-else>{{ $t('fan.login.signIn') }}</template>
        </button>
        <button
          type="button"
          class="fan-link"
          :disabled="inFlight !== null"
          data-testid="fan-login-mode"
          @click="setMode(mode === 'register' ? 'signin' : 'register')"
        >{{ mode === 'register' ? $t('fan.login.backToSignIn') : $t('fan.login.createAccount') }}</button>
      </div>

      <button
        type="button"
        class="fan-link"
        :disabled="inFlight !== null"
        data-testid="fan-login-link"
        @click="handleLink"
      >{{ inFlight === 'link' ? $t('fan.login.sending') : $t('fan.login.send') }}</button>
    </form>
  </div>
</template>

<style scoped src="./fan-styles.css" />
<style scoped>
.flf { display: flex; flex-direction: column; gap: 1rem; }
.flf-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.25rem; }
.flf-actions .fan-link { align-self: center; }
/* The link is a 44px target round one line of text: take that space back. */
.flf > .fan-form > .fan-link { margin-block: -0.5rem; }
</style>
