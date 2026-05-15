<script setup lang="ts">
import { ref, watch } from 'vue'

interface FileEntry {
  id: number
  file: File
  caption: string
  preview: string
}

defineProps<{ uploading?: boolean }>()

const emit = defineEmits<{
  change: [files: { file: File; caption: string }[]]
}>()

let nextId = 1
const entries   = ref<FileEntry[]>([])
const dropActive = ref(false)
const fileInput  = ref<HTMLInputElement | null>(null)

watch(entries, () => {
  emit('change', entries.value.map((e) => ({ file: e.file, caption: e.caption })))
}, { deep: true })

function addFiles(fileList: FileList | null) {
  if (!fileList) return
  for (const file of Array.from(fileList)) {
    if (!file.type.startsWith('image/')) continue
    const id    = nextId++
    const entry: FileEntry = { id, file, caption: '', preview: '' }
    const reader = new FileReader()
    reader.onload = (e) => { entry.preview = e.target?.result as string }
    reader.readAsDataURL(file)
    entries.value.push(entry)
  }
}

function onFileInput(e: Event) {
  addFiles((e.target as HTMLInputElement).files)
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e: DragEvent) {
  dropActive.value = false
  addFiles(e.dataTransfer?.files ?? null)
}

function removeEntry(id: number) {
  entries.value = entries.value.filter((e) => e.id !== id)
}

function moveUp(index: number) {
  if (index === 0) return
  const arr = entries.value;
  [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
}

function moveDown(index: number) {
  const arr = entries.value
  if (index === arr.length - 1) return;
  [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
}

function clear() {
  entries.value = []
  if (fileInput.value) fileInput.value.value = ''
}

defineExpose({ clear })
</script>

<template>
  <div>
    <div
      class="drop-zone"
      :class="{ active: dropActive }"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <span class="drop-icon">⬆</span>
      <span class="drop-label">Drop images here or click to browse</span>
      <span class="drop-hint">Supports JPG, PNG, WebP — max 20 MB each</span>
      <input ref="fileInput" type="file" accept="image/*" multiple style="display:none" @change="onFileInput" />
    </div>

    <div v-if="entries.length" class="file-grid">
      <div v-for="(entry, i) in entries" :key="entry.id" class="file-card">
        <div class="card-order">{{ i + 1 }}</div>
        <div class="card-thumb-wrap">
          <img v-if="entry.preview" :src="entry.preview" class="card-thumb" :alt="entry.caption || entry.file.name" />
          <div v-else class="card-thumb-placeholder">…</div>
        </div>
        <div class="card-body">
          <input v-model="entry.caption" class="card-title-input" placeholder="Caption (optional)" />
          <div class="card-filename">{{ entry.file.name }}</div>
        </div>
        <div class="card-actions">
          <button type="button" class="card-btn" :disabled="i === 0 || uploading" @click="moveUp(i)" title="Move up">↑</button>
          <button type="button" class="card-btn" :disabled="i === entries.length - 1 || uploading" @click="moveDown(i)" title="Move down">↓</button>
          <button type="button" class="card-btn remove" :disabled="uploading" @click="removeEntry(entry.id)" title="Remove">✕</button>
        </div>
      </div>
    </div>
    <p v-else class="no-files">No photos selected yet.</p>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.drop-zone {
  border: 2px dashed #1e2040;
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  transition: border-color 0.15s, background 0.15s;
  background: #0e0c2a;
}
.drop-zone.active, .drop-zone:hover { border-color: #6366f1; background: #14103a; }
.drop-icon  { font-size: 1.5rem; line-height: 1; }
.drop-label { font-size: 0.85rem; font-weight: 600; color: #c4b5fd; }
.drop-hint  { font-size: 0.72rem; color: #475569; }

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.65rem;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
  margin-top: 0.75rem;
}
.file-card {
  background: #0e0c2a;
  border: 1px solid #1e2040;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}
.card-order {
  position: absolute; top: 5px; left: 5px;
  background: #6366f1cc; color: #fff;
  font-size: 0.65rem; font-weight: 700;
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  z-index: 1;
}
.card-thumb-wrap { width: 100%; aspect-ratio: 4/3; background: #1a1740; overflow: hidden; }
.card-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #475569; }
.card-body { padding: 0.4rem 0.5rem; flex: 1; }
.card-title-input {
  width: 100%; background: transparent; border: none;
  border-bottom: 1px solid #1e2040; color: #e2e8f0;
  font-size: 0.75rem; padding: 2px 0; outline: none;
}
.card-title-input:focus { border-bottom-color: #6366f1; }
.card-filename { font-size: 0.62rem; color: #475569; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-actions { display: flex; gap: 3px; padding: 0.35rem 0.5rem; border-top: 1px solid #1e1a4a; }
.card-btn {
  flex: 1; font-size: 0.68rem; padding: 2px 0;
  background: #14103a; border: 1px solid #1e2040; border-radius: 4px;
  color: #94a3b8; cursor: pointer; transition: background 0.1s, color 0.1s;
}
.card-btn:hover:not(:disabled) { background: #1e1a50; color: #e2e8f0; }
.card-btn:disabled { opacity: 0.3; cursor: default; }
.card-btn.remove:hover:not(:disabled) { background: #3d1515; color: #f87171; border-color: #7f1d1d; }
.no-files { text-align: center; color: #475569; font-size: 0.82rem; padding: 0.75rem 0; }
</style>
