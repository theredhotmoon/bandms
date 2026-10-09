<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportSaveError } from '@/utils/formErrors'
import type { UploadedImage } from '@/api/client'

/**
 * One picture, uploaded the moment it is picked.
 *
 * The model is the picture itself: `{ url }` for one the record already has
 * (nothing to submit), `{ path, url }` once a new file has been stored
 * (`path` is what the form submits), and `null` after Remove. The file goes
 * to the server through `upload` as soon as it is chosen; the field used to
 * read it as a base64 data URL and submit that, which put the whole picture
 * into the `posts.image` column and from there into every list response.
 */
export interface ImageField { path?: string; url: string }

const props = defineProps<{
  modelValue: ImageField | null
  upload: (file: File) => Promise<UploadedImage>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ImageField | null] }>()

const { t } = useI18n()
const dropActive = ref(false)
const uploading  = ref(false)
const fileInput  = ref<HTMLInputElement | null>(null)

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) send(file)
}

function onDrop(e: DragEvent) {
  dropActive.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) send(file)
}

async function send(file: File) {
  if (!file.type.startsWith('image/')) return
  uploading.value = true
  try {
    const { path, url } = await props.upload(file)
    emit('update:modelValue', { path, url })
  } catch (e) {
    reportSaveError(e, t('common.imageUpload.uploadFailed'))
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function remove() {
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="siu-wrap">
    <div v-if="modelValue" class="siu-preview">
      <img :src="modelValue.url" alt="" class="siu-img" />
      <button type="button" class="siu-remove" @click="remove" :title="$t('common.imageUpload.remove')" :aria-label="$t('common.imageUpload.remove')">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>

    <!-- A real button, so the picker opens from the keyboard as well as from a
         click or a drop. -->
    <button
      v-else
      type="button"
      class="siu-drop"
      :class="{ active: dropActive }"
      :disabled="uploading"
      :aria-busy="uploading"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <svg class="siu-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span class="siu-label">{{ uploading ? $t('common.imageUpload.uploading') : $t('common.imageUpload.dropzone') }}</span>
      <span class="siu-hint">{{ $t('common.imageUpload.hint') }}</span>
    </button>
    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileInput" />
  </div>
</template>

<style scoped>
.siu-wrap { display: flex; flex-direction: column; }

.siu-drop {
  width: 100%;
  border: 2px dashed var(--c-2a2a2a);
  border-radius: 0.5rem;
  padding: 1.25rem 0.75rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  background: var(--c-141414);
  color: inherit;
  font: inherit;
  transition: border-color 150ms, background 150ms;
}
.siu-drop.active, .siu-drop:hover { border-color: var(--c-888888-line); background: var(--c-1a1a1a); }
.siu-drop:disabled { cursor: progress; opacity: 0.7; }
.siu-icon  { width: 1.75rem; height: 1.75rem; color: var(--c-334155); margin-bottom: 0.25rem; }
.siu-label { font-size: var(--fs-sm); font-weight: 600; color: var(--c-d0d0d0); text-wrap: balance; }
.siu-hint  { font-size: var(--fs-2xs); color: var(--c-475569); text-wrap: balance; }

.siu-preview {
  position: relative;
  display: inline-block;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--c-2a2a2a);
  max-width: 100%;
}
.siu-img { display: block; max-width: 100%; max-height: 220px; object-fit: contain; background: var(--c-0d0d0d); }
.siu-remove {
  position: absolute;
  top: 0.4rem; right: 0.4rem;
  display: flex; align-items: center; justify-content: center;
  width: 1.75rem; height: 1.75rem;
  background: color-mix(in srgb, var(--c-141414) 85%, transparent);
  color: var(--c-f87171);
  border: 1px solid var(--c-3f1212);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.12s;
}
.siu-remove:hover { background: var(--c-3f1212); }
</style>
