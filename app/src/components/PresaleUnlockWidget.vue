<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  concertId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  unlocked: [tierIds: number[]]
}>()

const code = ref('')
const loading = ref(false)
const unlocked = ref(false)
const error = ref<string | null>(null)

async function submit() {
  if (!code.value.trim() || loading.value || unlocked.value) return

  loading.value = true
  error.value = null

  try {
    const res = await fetch('/api/presale-codes/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code: code.value.trim(), concert_id: props.concertId }),
    })

    const data = (await res.json()) as { valid: boolean; tier_ids?: number[]; message?: string }

    if (data.valid) {
      unlocked.value = true
      emit('unlocked', data.tier_ids ?? [])
    } else {
      error.value = data.message ?? 'Invalid code.'
    }
  } catch {
    error.value = 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="presale-widget">
    <label class="widget-label">Have a pre-sale code?</label>
    <div class="row">
      <input
        v-model="code"
        class="code-input"
        placeholder="Enter code"
        :disabled="unlocked"
        @keyup.enter="submit"
      />
      <button class="unlock-btn" :disabled="loading || unlocked" @click="submit">
        {{ loading ? '...' : 'Unlock' }}
      </button>
    </div>
    <p v-if="unlocked" class="success">&#10003; Pre-sale access unlocked!</p>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.presale-widget {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.widget-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #cbd5e1;
}

.row {
  display: flex;
  gap: 0.5rem;
}

.code-input {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #e2e8f0;
  outline: none;
  transition: border-color 120ms;
}
.code-input:focus { border-color: #3b82f6; }
.code-input:disabled { opacity: 0.6; }

.unlock-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  background: #1d4ed8;
  border: none;
  color: #fff;
  cursor: pointer;
  transition: background 120ms;
  white-space: nowrap;
}
.unlock-btn:hover:not(:disabled) { background: #1e40af; }
.unlock-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.success {
  margin: 0;
  font-size: 0.875rem;
  color: #4ade80;
  font-weight: 500;
}

.error {
  margin: 0;
  font-size: 0.875rem;
  color: #f87171;
}
</style>
