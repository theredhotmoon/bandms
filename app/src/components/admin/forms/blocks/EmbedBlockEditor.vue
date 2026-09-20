<script setup lang="ts">
import { computed } from 'vue'
import { providerLabel, detectProvider, isAudioProvider } from '@/utils/postBlocks'

const props = defineProps<{ payload: Record<string, unknown>; hideLabel?: boolean }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const url = computed(() => (props.payload.url as string) ?? '')

// Preview only — the server re-detects and stores the provider on save.
const detected = computed(() => detectProvider(url.value))

const label = computed(() => (props.payload.label ?? {}) as { en?: string; pl?: string })

function set(key: string, value: unknown) {
  emit('update:payload', { ...props.payload, [key]: value })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <input
        :value="url" @input="set('url', ($event.target as HTMLInputElement).value)"
        class="field-input flex-1" placeholder="Paste a video (YouTube, Vimeo, Instagram, TikTok, Facebook) or audio (Spotify, SoundCloud, Apple Music) URL" required
      />
      <span v-if="url" class="provider-badge">{{ isAudioProvider(detected) ? 'Audio · ' : '' }}{{ providerLabel(detected) }}</span>
    </div>
    <div v-if="detected === 'link' && !hideLabel" class="trans-group">
      <div class="trans-row">
        <span class="lang-badge">EN</span>
        <input :value="label.en ?? ''" @input="set('label', { ...label, en: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Link text (optional)" />
      </div>
      <div class="trans-row">
        <span class="lang-badge lang-badge--pl">PL</span>
        <input :value="label.pl ?? ''" @input="set('label', { ...label, pl: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Tekst linku (opcjonalnie)" />
      </div>
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
<style scoped>
.provider-badge {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em;
  padding: 0.25rem 0.5rem; border-radius: 0.25rem; flex-shrink: 0;
  background: #1e3a5f; color: #60a5fa; text-transform: uppercase;
}
</style>
