<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ modelValue?: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const dropActive = ref(false)
const fileInput  = ref<HTMLInputElement | null>(null)

function readFile(file: File) {
  if (!file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = (e) => emit('update:modelValue', e.target?.result as string)
  reader.readAsDataURL(file)
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) readFile(file)
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e: DragEvent) {
  dropActive.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) readFile(file)
}

function remove() {
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="siu-wrap">
    <div
      v-if="modelValue"
      class="siu-preview"
    >
      <img :src="modelValue" :alt="$t('common.imageUpload.alt')" class="siu-img" />
      <button type="button" class="siu-remove" @click="remove" :title="$t('common.imageUpload.remove')">✕</button>
    </div>

    <div
      v-else
      class="siu-drop"
      :class="{ active: dropActive }"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <span class="siu-icon">⬆</span>
      <span class="siu-label">{{ $t('common.imageUpload.dropzone') }}</span>
      <span class="siu-hint">{{ $t('common.imageUpload.hint') }}</span>
      <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileInput" />
    </div>
  </div>
</template>

<style scoped>
.siu-wrap { display: flex; flex-direction: column; }

.siu-drop {
  border: 2px dashed var(--c-2a2a2a);
  border-radius: 0.5rem;
  padding: 1.25rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  background: var(--c-0e0c2a);
  transition: border-color 0.15s, background 0.15s;
}
.siu-drop.active, .siu-drop:hover { border-color: var(--c-888888); background: var(--c-1a1a1a); }
.siu-icon  { font-size: 1.25rem; line-height: 1; }
.siu-label { font-size: 0.8rem; font-weight: 600; color: var(--c-d0d0d0); }
.siu-hint  { font-size: 0.7rem; color: var(--c-475569); }

.siu-preview {
  position: relative;
  display: inline-block;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--c-2a2a2a);
  max-width: 100%;
}
.siu-img { display: block; max-width: 100%; max-height: 220px; object-fit: contain; background: var(--c-0a0820); }
.siu-remove {
  position: absolute;
  top: 0.4rem; right: 0.4rem;
  background: color-mix(in srgb, var(--c-1a0808) 80%, transparent); color: var(--c-f87171);
  border: 1px solid var(--c-7f1d1d);
  border-radius: 0.375rem;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  line-height: 1.4;
  transition: background 0.12s;
}
.siu-remove:hover { background: color-mix(in srgb, var(--c-3d1515) 80%, transparent); }
</style>
