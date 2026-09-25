<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { requestMagicLink } from '@/api/fan'
import { ApiValidationError } from '@/api/client'

const { t } = useI18n()

const emit = defineEmits<{
  'magic-link-sent': [devLink: string]
}>()

const email = ref('')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

async function handleSubmit() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const result = await requestMagicLink(email.value)
    emit('magic-link-sent', result.dev_link)
  } catch (err) {
    if (err instanceof ApiValidationError) {
      errorMessage.value = Object.values(err.errors).flat().join(' ')
    } else {
      errorMessage.value = err instanceof Error ? err.message : t('fan.login.failed')
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flf-card">
    <h1>{{ $t('fan.login.title') }}</h1>
    <p>{{ $t('fan.login.lead') }}</p>
    <form @submit.prevent="handleSubmit" class="flf-form">
      <label for="fan-email" class="flf-label">{{ $t('fan.login.email') }}</label>
      <input
        id="fan-email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        required
        class="flf-input"
        :disabled="isLoading"
      />
      <p v-if="errorMessage" class="flf-error" role="alert">{{ errorMessage }}</p>
      <button type="submit" class="flf-btn" :disabled="isLoading">
        {{ isLoading ? $t('fan.login.sending') : $t('fan.login.send') }}
      </button>
    </form>
  </div>
</template>
