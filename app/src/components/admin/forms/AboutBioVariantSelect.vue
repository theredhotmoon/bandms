<script setup lang="ts">
import type { BioVariant } from '@/types/bandProfile'

defineProps<{
  modelValue: BioVariant
}>()

defineEmits<{
  'update:modelValue': [BioVariant]
}>()
</script>

<template>
  <div class="about-variant-row">
    <label class="field-label" for="about-bio-variant">{{ $t('band.profile.bio.aboutVariantLabel') }}</label>
    <select
      id="about-bio-variant"
      :value="modelValue"
      class="field-input about-variant-select"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as BioVariant)"
    >
      <!-- The same four labels the Bio tab's variant tabs use — one set of
           strings, so the tab and this selector can never drift apart. -->
      <option value="short">{{ $t('band.profile.bio.variants.short') }}</option>
      <option value="medium">{{ $t('band.profile.bio.variants.medium') }}</option>
      <option value="long">{{ $t('band.profile.bio.variants.long') }}</option>
      <option value="full">{{ $t('band.profile.bio.variants.full') }}</option>
    </select>
  </div>
</template>

<style scoped>
.about-variant-row {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  margin: 0.625rem 0; padding: 0.5rem 0.75rem;
  background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
}
.about-variant-row .field-label { margin: 0; }
.about-variant-select { width: auto; min-width: 8rem; }
</style>
