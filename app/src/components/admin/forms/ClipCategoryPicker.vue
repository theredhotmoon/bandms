<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch } from 'vue'
import { CLIP_CATEGORY_PRESETS, isPresetCategory, presetMessageKey } from '@/utils/clipCategories'

const { t } = useI18n()

/**
 * Five preset chips plus a free-text input. A chip fills the input; typing
 * something that is not a preset clears the active chip. One value either way.
 */
const model = defineModel<string>({ default: 'live' })

// The input keeps its own text rather than deriving it from the model: while
// typing "live acoustic" the model passes through "live", and a computed that
// blanks on presets would empty the field at that keystroke. Text is only
// written *from* the model when it changes to something the text does not
// already spell — a chip press, or the host form resetting it.
const text = ref(isPresetCategory(model.value) ? '' : model.value)

watch(model, value => {
  if (isPresetCategory(value)) {
    if (text.value.trim() !== value) text.value = ''
  } else if (text.value.trim() !== value) {
    text.value = value
  }
})

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  model.value = text.value.trim() || 'live'
}

// A custom category prints as the band typed it; only presets are translated.
function categoryLabel(value: string): string {
  const key = presetMessageKey(value)
  return key ? t(key) : value
}
</script>

<template>
  <div class="cat-picker">
    <div class="link-presets">
      <button v-for="p in CLIP_CATEGORY_PRESETS" :key="p" type="button" class="preset-chip"
              :class="{ active: model === p }" @click="model = p">{{ categoryLabel(p) }}</button>
    </div>
    <!-- Enter must not implicitly submit whichever form hosts this picker. -->
    <input :value="text" class="field-input" :placeholder="$t('common.clipCategory.customPlaceholder')"
           maxlength="64" data-testid="clip-category-custom"
           @input="onInput" @keydown.enter.prevent />
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
