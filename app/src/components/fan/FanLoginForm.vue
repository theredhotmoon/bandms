<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { loginFan, registerFan, requestMagicLink, type VerifyResponse } from '@/api/fan'
import { fanErrorMessage, serverRefused } from '@/utils/fanErrors'
import { withNewClaim } from '@/utils/fanClaim'

const { t } = useI18n()

const emit = defineEmits<{
  'magic-link-sent': [devLink: string | null]
  'signed-in': [result: VerifyResponse]
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

function browserStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

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
  <div class="flf-card" data-testid="fan-login">
    <h1>{{ $t('fan.login.title') }}</h1>

    <p v-if="notice" role="status" aria-live="polite" data-testid="fan-login-notice">{{ notice }}</p>

    <form v-else class="flf-form" @submit.prevent="handleSubmit">
      <p>{{ $t('fan.login.lead') }}</p>

      <label for="fan-email" class="flf-label">{{ $t('fan.login.email') }}</label>
      <input
        id="fan-email"
        ref="emailInput"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        required
        class="flf-input"
        :disabled="inFlight !== null"
        data-testid="fan-login-email"
      />

      <label for="fan-password" class="flf-label">{{ $t('fan.login.password') }}</label>
      <input
        id="fan-password"
        v-model="password"
        type="password"
        name="password"
        :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
        :minlength="mode === 'register' ? 8 : undefined"
        :aria-describedby="mode === 'register' ? 'fan-password-hint' : undefined"
        required
        class="flf-input"
        :disabled="inFlight !== null"
        data-testid="fan-login-password"
      />
      <p v-if="mode === 'register'" id="fan-password-hint" class="flf-hint">{{ $t('fan.login.passwordHint') }}</p>

      <p v-if="errorMessage" class="flf-error" role="alert" data-testid="fan-login-error">{{ errorMessage }}</p>

      <div class="flf-actions">
        <button type="submit" class="flf-btn" :disabled="inFlight !== null" data-testid="fan-login-submit">
          <template v-if="inFlight === 'signin'">{{ $t('fan.login.signingIn') }}</template>
          <template v-else-if="inFlight === 'register'">{{ $t('fan.login.creating') }}</template>
          <template v-else-if="mode === 'register'">{{ $t('fan.login.createSubmit') }}</template>
          <template v-else>{{ $t('fan.login.signIn') }}</template>
        </button>
        <button
          type="button"
          class="flf-link"
          :disabled="inFlight !== null"
          data-testid="fan-login-mode"
          @click="setMode(mode === 'register' ? 'signin' : 'register')"
        >{{ mode === 'register' ? $t('fan.login.backToSignIn') : $t('fan.login.createAccount') }}</button>
      </div>

      <button
        type="button"
        class="flf-link"
        :disabled="inFlight !== null"
        data-testid="fan-login-link"
        @click="handleLink"
      >{{ inFlight === 'link' ? $t('fan.login.sending') : $t('fan.login.send') }}</button>
    </form>
  </div>
</template>

<style scoped>
.flf-form { display: flex; flex-direction: column; gap: 8px; max-width: 28rem; }
.flf-input { width: 100%; box-sizing: border-box; }
.flf-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.flf-hint { margin: 0; font-size: 0.85em; }
.flf-link { align-self: flex-start; background: none; border: none; padding: 4px 0; text-decoration: underline; cursor: pointer; color: inherit; }
</style>
