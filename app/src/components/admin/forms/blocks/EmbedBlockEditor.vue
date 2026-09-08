<script setup lang="ts">
import { computed } from 'vue'
import { providerLabel } from '@/utils/postBlocks'
import type { EmbedProviderName } from '@/types/post'

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const url = computed(() => (props.payload.url as string) ?? '')

/**
 * Preview only. The server detects and stores the provider on save — this
 * mirrors the same host list so the editor sees what it will get, and the two
 * cannot disagree about the stored value because the client never sends one.
 */
const detected = computed<EmbedProviderName>(() => {
  const u = url.value.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('vimeo.com')) return 'vimeo'
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('tiktok.com')) return 'tiktok'
  return 'link'
})

function set(key: string, value: unknown) {
  emit('update:payload', { ...props.payload, [key]: value })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <input
        :value="url" @input="set('url', ($event.target as HTMLInputElement).value)"
        class="field-input flex-1" placeholder="Paste a YouTube, Vimeo, Instagram or TikTok URL" required
      />
      <span v-if="url" class="provider-badge">{{ providerLabel(detected) }}</span>
    </div>
    <input
      v-if="detected === 'link'"
      :value="(payload.label as string) ?? ''"
      @input="set('label', ($event.target as HTMLInputElement).value || null)"
      class="field-input" placeholder="Link text (optional)"
    />
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
