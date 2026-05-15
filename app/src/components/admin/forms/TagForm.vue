<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Tag, TagPayload } from '@/types/tag'

const props = defineProps<{
  initial?: Tag | null
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [TagPayload]; cancel: [] }>()

const form = reactive<TagPayload>({ name: '' })

watch(() => props.initial, (val) => { form.name = val?.name ?? '' }, { immediate: true })

function submit() { emit('submit', { name: form.name }) }
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">Name <span style="color:#f87171;">*</span></label>
      <input v-model="form.name" required class="field-input" placeholder="Tag name" />
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
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
