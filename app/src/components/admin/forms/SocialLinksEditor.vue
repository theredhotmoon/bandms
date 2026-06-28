<script setup lang="ts">
import { reactive, watch } from 'vue'
import { SOCIAL_PLATFORMS } from '@/types/socialLink'
import type { SocialPlatform, SocialLinkPayload } from '@/types/socialLink'

interface Props {
  modelValue: SocialLinkPayload[]
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Social links',
})

const emit = defineEmits<{
  'update:modelValue': [links: SocialLinkPayload[]]
}>()

const urls = reactive<Record<SocialPlatform, string>>({
  spotify: '', instagram: '', facebook: '', youtube: '',
  tiktok: '', bandcamp: '', soundcloud: '', twitter: '', website: '',
})

watch(
  () => props.modelValue,
  (val) => {
    for (const p of SOCIAL_PLATFORMS) urls[p.key] = ''
    for (const l of (val ?? [])) urls[l.platform] = l.url
  },
  { immediate: true },
)

function emitLinks() {
  emit(
    'update:modelValue',
    SOCIAL_PLATFORMS
      .filter((p) => urls[p.key].trim())
      .map((p) => ({ platform: p.key, url: urls[p.key].trim() })),
  )
}
</script>

<template>
  <div class="social-links-editor">
    <div class="social-links-editor__heading">{{ label }}</div>
    <div class="social-links-editor__list">
      <div
        v-for="p in SOCIAL_PLATFORMS"
        :key="p.key"
        class="social-links-editor__row"
      >
        <span
          class="social-links-editor__dot"
          :style="{ background: p.color }"
          aria-hidden="true"
        />
        <span class="social-links-editor__name">{{ p.label }}</span>
        <input
          v-model="urls[p.key]"
          class="field-input social-links-editor__input"
          type="url"
          :placeholder="`${p.label} URL…`"
          :aria-label="p.label"
          @input="emitLinks"
        />
      </div>
    </div>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.social-links-editor__heading {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #d0d0d0;
  margin-bottom: 0.5rem;
}

.social-links-editor__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.social-links-editor__row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.social-links-editor__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  flex-shrink: 0;
}

.social-links-editor__name {
  font-size: 0.75rem;
  font-weight: 500;
  color: #94a3b8;
  width: 7rem;
  flex-shrink: 0;
}

.social-links-editor__input {
  flex: 1;
}
</style>
