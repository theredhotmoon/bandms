<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { verifyMagicLink } from '@/api/fan'
import { useFanAccount } from '@/composables/useFanAccount'

const { t } = useI18n()

const props = defineProps<{ devLink: string | null }>()
const { setSession } = useFanAccount()

const errorMessage = ref<string | null>(null)

// Extract token from devLink and allow clicking
async function handleVerify() {
  errorMessage.value = null
  try {
    const url = new URL(props.devLink ?? '')
    const token = url.searchParams.get('token') ?? ''
    const result = await verifyMagicLink(token)
    setSession(result.token, result.fan)
  } catch {
    errorMessage.value = t('fan.login.linkInvalid')
  }
}
</script>

<template>
  <div class="fmls-card">
    <h2>{{ $t('fan.login.sentTitle') }}</h2>
    <p>{{ $t('fan.login.sentBody') }}</p>
    <!-- The API only returns dev_link under APP_DEBUG. Without this guard the
         production build printed "Dev mode: Click here to sign in" as an <a>
         with no href — visible, unclickable, and addressed to the wrong
         audience. -->
    <p v-if="devLink" class="fmls-dev">
      <strong>{{ $t('fan.login.devMode') }}</strong>
      <a :href="devLink" @click.prevent="handleVerify" class="fmls-link">{{ $t('fan.login.devSignIn') }}</a>
    </p>
    <p v-if="errorMessage" role="alert" class="fmls-error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.fmls-error {
  color: #dc2626;
  margin-top: 0.5rem;
  font-size: 0.875rem;
}
</style>
