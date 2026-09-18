<script setup lang="ts">
import { computed } from 'vue'
import { CLIP_CATEGORY_PRESETS, isPresetCategory, presetLabel } from '@/utils/clipCategories'

/**
 * Five preset chips plus a free-text input. A chip fills the input; typing
 * something that is not a preset clears the active chip. One value either way.
 */
const model = defineModel<string>({ default: 'live' })

const custom = computed(() => (isPresetCategory(model.value) ? '' : model.value))
</script>

<template>
  <div class="cat-picker">
    <div class="link-presets">
      <button v-for="p in CLIP_CATEGORY_PRESETS" :key="p" type="button" class="preset-chip"
              :class="{ active: model === p }" @click="model = p">{{ presetLabel(p) }}</button>
    </div>
    <input :value="custom" class="field-input" placeholder="…or type your own category"
           maxlength="64" data-testid="clip-category-custom"
           @input="model = ($event.target as HTMLInputElement).value.trim() || 'live'" />
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.cat-picker { display: flex; flex-direction: column; gap: 0.5rem; }
.link-presets { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.preset-chip {
  padding: 0.2rem 0.625rem; border-radius: 999px; border: 1px solid #2a2a2a;
  background: #141414; color: #94a3b8; font-size: 0.75rem; cursor: pointer;
  transition: border-color 100ms, color 100ms, background 100ms;
}
.preset-chip:hover, .preset-chip.active { border-color: #888888; color: #d0d0d0; background: #1a1a1a; }
</style>
