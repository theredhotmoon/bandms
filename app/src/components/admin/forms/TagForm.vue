<script setup lang="ts">
import { reactive, watch } from 'vue'
import SlugInput from '@/components/admin/forms/SlugInput.vue'
import { LOCALES, emptyBag } from '@/locales'
import type { Tag, TagPayload } from '@/types/tag'

const props = defineProps<{
  initial?: Tag | null
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [TagPayload]; cancel: [] }>()

const form = reactive({
  name: emptyBag(),
  slug_en: '',
  slug_pl: '',
})

watch(() => props.initial, (val) => {
  for (const l of LOCALES) {
    form.name[l] = val?.translations?.name[l] ?? ''
  }
  form.slug_en = val?.slug_en ?? ''
  form.slug_pl = val?.slug_pl ?? ''
}, { immediate: true })

function submit() {
  emit('submit', {
    name: Object.fromEntries(LOCALES.map(l => [l, form.name[l].trim() || null])) as TagPayload['name'],
    slug_en: form.slug_en || null,
    slug_pl: form.slug_pl || null,
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">Name <span style="color:#f87171;">*</span></label>
      <div class="trans-group">
        <div v-for="l in LOCALES" :key="l" class="trans-row">
          <span class="lang-badge">{{ l.toUpperCase() }}</span>
          <input v-model="form.name[l]" class="field-input flex-1" placeholder="Tag name" />
        </div>
      </div>
      <template v-for="l in LOCALES" :key="`name-err-${l}`">
        <p v-if="errors?.[`name.${l}`]" class="field-error">{{ errors[`name.${l}`][0] }}</p>
      </template>
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>
    <div>
      <label class="field-label">Slug URL</label>
      <SlugInput
        v-model="form.slug_en"
        v-model:modelValuePl="form.slug_pl"
        :sourceEn="form.name.en"
        :sourcePl="form.name.pl"
        :bilingual="true"
      />
      <p v-if="errors?.slug_en" class="field-error">{{ errors.slug_en[0] }}</p>
      <p v-if="errors?.slug_pl" class="field-error">{{ errors.slug_pl[0] }}</p>
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
