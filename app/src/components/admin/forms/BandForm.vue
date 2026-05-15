<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Band, BandPayload } from '@/types/band'

const props = defineProps<{
  initial?: Band | null
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [BandPayload]; cancel: [] }>()

const form = reactive<{ name: string; website: string }>({ name: '', website: '' })

watch(
  () => props.initial,
  (val) => {
    form.name    = val?.name ?? ''
    form.website = val?.website ?? ''
  },
  { immediate: true },
)

function submit() {
  emit('submit', { name: form.name, website: form.website || null })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">Name <span style="color:#f87171;">*</span></label>
      <input v-model="form.name" required class="field-input" placeholder="Band name" />
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>
    <div>
      <label class="field-label">Website</label>
      <input v-model="form.website" type="url" class="field-input" placeholder="https://…" />
      <p v-if="errors?.website" class="field-error">{{ errors.website[0] }}</p>
    </div>
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update' : 'Create') }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
