<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useAuth } from '@/composables/useAuth'
import { ApiError, ApiValidationError } from '@/api/auth'

const emit = defineEmits<{
  success: []
}>()

const { login } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const generalError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

async function handleSubmit() {
  generalError.value = null
  fieldErrors.value = {}
  loading.value = true

  try {
    await login({ email: email.value, password: password.value })
    toast.success('Welcome back! Great to see you again.')
    emit('success')
  } catch (err) {
    if (err instanceof ApiValidationError) {
      const flat: Record<string, string> = {}
      for (const [key, msgs] of Object.entries(err.errors)) {
        flat[key] = msgs[0]
      }
      fieldErrors.value = flat
    } else if (err instanceof ApiError) {
      generalError.value = err.message
    } else {
      generalError.value = 'An unexpected error occurred. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="handleSubmit">
    <p v-if="generalError" class="field-error rounded px-3 py-2 text-xs" style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2);">
      {{ generalError }}
    </p>

    <div>
      <label class="field-label">Email</label>
      <input
        v-model="email"
        type="email"
        required
        autocomplete="email"
        class="field-input"
        :class="{ 'border-red-500': fieldErrors.email }"
        placeholder="your@email.com"
      />
      <p v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</p>
    </div>

    <div>
      <label class="field-label">Password</label>
      <input
        v-model="password"
        type="password"
        required
        autocomplete="current-password"
        class="field-input"
        :class="{ 'border-red-500': fieldErrors.password }"
        placeholder="••••••••"
      />
      <p v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</p>
    </div>

    <button type="submit" :disabled="loading" class="btn-primary w-full justify-center">
      {{ loading ? 'Signing in…' : 'Sign In' }}
    </button>
  </form>
</template>

<style scoped src="@/components/admin/form-styles.css" />
