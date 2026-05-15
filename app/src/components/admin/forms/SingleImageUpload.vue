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
      <img :src="modelValue" alt="Post image" class="siu-img" />
      <button type="button" class="siu-remove" @click="remove" title="Remove image">✕</button>
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
      <span class="siu-label">Drop image or click to browse</span>
      <span class="siu-hint">JPG, PNG, WebP — max 20 MB</span>
      <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileInput" />
    </div>
  </div>
</template>

<style scoped>
.siu-wrap { display: flex; flex-direction: column; }

.siu-drop {
  border: 2px dashed #1e2040;
  border-radius: 0.5rem;
  padding: 1.25rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  background: #0e0c2a;
  transition: border-color 0.15s, background 0.15s;
}
.siu-drop.active, .siu-drop:hover { border-color: #6366f1; background: #14103a; }
.siu-icon  { font-size: 1.25rem; line-height: 1; }
.siu-label { font-size: 0.8rem; font-weight: 600; color: #c4b5fd; }
.siu-hint  { font-size: 0.7rem; color: #475569; }

.siu-preview {
  position: relative;
  display: inline-block;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid #1e2040;
  max-width: 100%;
}
.siu-img { display: block; max-width: 100%; max-height: 220px; object-fit: contain; background: #0a0820; }
.siu-remove {
  position: absolute;
  top: 0.4rem; right: 0.4rem;
  background: #1a0808cc; color: #f87171;
  border: 1px solid #7f1d1d;
  border-radius: 0.375rem;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  line-height: 1.4;
  transition: background 0.12s;
}
.siu-remove:hover { background: #3d1515cc; }
</style>
