<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { uploadPostBlockImage } from '@/api/postBlocks'
import { useAuth } from '@/composables/useAuth'

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const { token } = useAuth()
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const bag = (key: 'alt' | 'caption') => (props.payload[key] ?? {}) as { en?: string; pl?: string }

function set(key: string, value: unknown) {
  emit('update:payload', { ...props.payload, [key]: value })
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const { path, url } = await uploadPostBlockImage(token.value!, file)
    // `url` is kept alongside `path` purely so the editor can show a preview
    // before the post is saved; only `path` is submitted.
    emit('update:payload', { ...props.payload, path, url })
  } catch {
    toast.error('Image upload failed')
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="payload.url || payload.path" class="img-preview">
      <img :src="(payload.url as string) ?? `/storage/${payload.path}`" alt="" class="img-preview-el" />
      <button type="button" class="btn-remove" @click="set('path', '')" title="Remove image">✕</button>
    </div>
    <div v-else class="siu-drop" @click="fileInput?.click()">
      <span class="siu-label">{{ uploading ? 'Uploading…' : 'Click to upload an image' }}</span>
      <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFile" />
    </div>

    <div class="trans-group">
      <div class="trans-row">
        <span class="lang-badge">EN</span>
        <input :value="bag('alt').en ?? ''" @input="set('alt', { ...bag('alt'), en: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Alt text (describes the image)" />
      </div>
      <div class="trans-row">
        <span class="lang-badge lang-badge--pl">PL</span>
        <input :value="bag('alt').pl ?? ''" @input="set('alt', { ...bag('alt'), pl: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Tekst alternatywny" />
      </div>
      <div class="trans-row">
        <span class="lang-badge">EN</span>
        <input :value="bag('caption').en ?? ''" @input="set('caption', { ...bag('caption'), en: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Caption (optional)" />
      </div>
      <div class="trans-row">
        <span class="lang-badge lang-badge--pl">PL</span>
        <input :value="bag('caption').pl ?? ''" @input="set('caption', { ...bag('caption'), pl: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Podpis" />
      </div>
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
<style scoped>
.img-preview { position: relative; display: inline-block; }
.img-preview-el { max-height: 10rem; border-radius: 0.375rem; display: block; }
.siu-drop {
  border: 2px dashed #3f3f46; border-radius: 0.375rem; padding: 1.25rem;
  text-align: center; cursor: pointer; color: #a1a1aa;
}
</style>
