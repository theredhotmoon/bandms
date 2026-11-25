<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchFanMe, fetchFanProviders, setFanPassword } from '@/api/fan'
import { knownProviders, providerName } from '@/utils/authQuery'
import { ApiError, ApiValidationError } from '@/api/client'
import { useFanAccount } from '@/composables/useFanAccount'
import { fanErrorMessage } from '@/utils/fanErrors'

const { t, locale } = useI18n()
const { token, fan, setSession, clearSession } = useFanAccount()

// The stored fan can be stale (`password_needs_current` flips 15 minutes after
// a link sign-in; a fan stored before this feature has neither field), so the
// form is shown only once /api/fan/me has answered.
const ready = ref(false)
const loadError = ref<string | null>(null)

const currentPassword = ref('')
const newPassword = ref('')
const busy = ref(false)
const errorMessage = ref<string | null>(null)
const saved = ref(false)
// Set when the server asks for the current password although we thought none
// was needed — the field then appears rather than leaving the fan stuck.
const forceCurrent = ref(false)

// Which providers the band has set up. Asked once, never waited for.
const configured = ref<string[]>([])
let gone = false
onBeforeUnmount(() => { gone = true })
const linked = computed(() => knownProviders(fan.value?.providers ?? []))
const linkedNames = computed(() => linked.value.map(providerName).join(', '))
// What could be connected: only what the band has keys for.
const configuredNames = computed(() =>
  new Intl.ListFormat(locale.value, { type: 'disjunction' }).format(configured.value.map(providerName)))
// No key, no mention: with nothing configured and nothing linked the line is absent.
const showProviders = computed(() => configured.value.length > 0 || linked.value.length > 0)

const hasPassword = computed(() => fan.value?.has_password === true)
const needsCurrent = computed(() => forceCurrent.value || fan.value?.password_needs_current === true)

/** A lapsed session ends here: the account page then shows the sign-in form. */
function endIfUnauthorised(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 401) {
    clearSession()
    return true
  }
  return false
}

/**
 * Runs a request made with the current session and hands back what it
 * returned, or `undefined` when the answer must be ignored: the fan signed out
 * or another session replaced this one while it was in flight. A late answer
 * (or a late 401) for an old token must not rewrite or end a newer session.
 * A rejection is passed to `onError` only while the asking session still holds.
 */
async function asSession<T>(
  request: (asked: string) => Promise<T>,
  onError: (err: unknown) => void,
): Promise<{ asked: string; value: T } | undefined> {
  const asked = token.value
  if (!asked) return undefined
  try {
    const value = await request(asked)
    return token.value === asked ? { asked, value } : undefined
  } catch (err) {
    if (token.value === asked) onError(err)
    return undefined
  }
}

async function load() {
  loadError.value = null
  const answer = await asSession(fetchFanMe, (err) => {
    if (!endIfUnauthorised(err)) loadError.value = t('fan.account.optionsLoadFailed')
  })
  if (!answer) return
  setSession(answer.asked, answer.value)
  ready.value = true
}

async function save() {
  if (!token.value || busy.value) return
  busy.value = true
  errorMessage.value = null
  saved.value = false
  const answer = await asSession(
    (asked) => setFanPassword(asked, newPassword.value, needsCurrent.value ? currentPassword.value : undefined),
    (err) => {
      if (endIfUnauthorised(err)) return
      if (err instanceof ApiValidationError && err.errors.current_password?.length) forceCurrent.value = true
      errorMessage.value = fanErrorMessage(err, t('fan.account.passwordFailed'))
    },
  )
  if (answer) {
    // The token stays: only the fan's flags changed.
    setSession(answer.asked, answer.value)
    forceCurrent.value = false
    currentPassword.value = ''
    newPassword.value = ''
    saved.value = true
  }
  busy.value = false
}

onMounted(async () => {
  void load()
  const found = await fetchFanProviders()
  if (!gone) configured.value = found
})
</script>

<template>
  <section class="fan-card fso" data-testid="fan-signin-options" aria-labelledby="fso-title">
    <h2 id="fso-title" class="fan-subtitle">{{ hasPassword ? $t('fan.account.changePassword') : $t('fan.account.setPassword') }}</h2>

    <template v-if="!ready">
      <template v-if="loadError">
        <p class="fan-msg fan-msg--error" role="alert" data-testid="fan-options-error">{{ loadError }}</p>
        <button type="button" class="fan-link" @click="load">{{ $t('fan.account.retry') }}</button>
      </template>
      <p v-else class="fan-hint" role="status">{{ $t('fan.account.optionsLoading') }}</p>
    </template>

    <form v-else class="fan-form fso-form" @submit.prevent="save">
      <p v-if="!hasPassword" class="fan-text">{{ $t('fan.account.passwordLead') }}</p>

      <div v-if="needsCurrent" class="fan-field">
        <label for="fan-current-password" class="fan-label">{{ $t('fan.account.currentPassword') }}</label>
        <input
          id="fan-current-password"
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          required
          class="fan-input"
          data-testid="fan-current-password"
        />
      </div>

      <div class="fan-field">
        <label for="fan-new-password" class="fan-label">{{ $t('fan.account.newPassword') }}</label>
        <input
          id="fan-new-password"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
          aria-describedby="fan-new-password-hint"
          class="fan-input"
          data-testid="fan-new-password"
        />
        <p id="fan-new-password-hint" class="fan-hint">{{ $t('fan.login.passwordHint') }}</p>
      </div>

      <p v-if="errorMessage" class="fan-msg fan-msg--error" role="alert" data-testid="fan-password-error">{{ errorMessage }}</p>
      <p v-if="saved" class="fan-msg" role="status" aria-live="polite" data-testid="fan-password-saved">{{ $t('fan.account.passwordSaved') }}</p>

      <button type="submit" class="fan-btn" :disabled="busy" data-testid="fan-password-save">
        {{ busy ? $t('fan.account.saving') : $t('fan.account.savePassword') }}
      </button>
    </form>

    <p v-if="ready && showProviders" class="fan-hint fso-linked" data-testid="fan-linked-providers">
      {{ linked.length > 0 ? $t('fan.account.linked', { providers: linkedNames }) : $t('fan.account.linkedNone', { providers: configuredNames }) }}
    </p>
  </section>
</template>

<style scoped src="./fan-styles.css" />
<style scoped>
.fso { display: flex; flex-direction: column; gap: 1rem; }
.fso-form { max-width: 28rem; }
.fso-form .fan-btn { align-self: flex-start; }
.fso-linked {
  padding-top: 1rem;
  border-top: 1px solid color-mix(in srgb, var(--color-ink) 18%, transparent);
}
</style>
