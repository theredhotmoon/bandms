<script setup lang="ts">
import { computed, ref } from 'vue'
import ImageDropZone from './ImageDropZone.vue'
import UploadProgressBar from './UploadProgressBar.vue'
import type { UploadProgress } from '@/api/albums'

// Adds photos to an album that already exists. The album's own fields are
// edited elsewhere, so unlike BatchPhotoUpload this is only the drop zone.
const props = defineProps<{
  uploading?: boolean
  progress?: UploadProgress | null
}>()

const emit = defineEmits<{
  upload: [files: { file: File; caption: string }[]]
  cancel: []
}>()

const pendingFiles = ref<{ file: File; caption: string }[]>([])
const canUpload = computed(() => pendingFiles.value.length > 0 && !props.uploading)
</script>

<template>
  <div class="add-photos" data-testid="album-add-photos">
    <ImageDropZone :uploading="uploading" @change="pendingFiles = $event" />
    <UploadProgressBar v-if="uploading" :percent="progress?.percent ?? 0" />
    <div class="flex gap-2 justify-end">
      <button type="button" class="btn-ghost" :disabled="uploading" @click="emit('cancel')">{{ $t('common.actions.cancel') }}</button>
      <button type="button" class="btn-primary" :disabled="!canUpload" @click="emit('upload', pendingFiles)">
        {{ uploading
          ? $t('media.batchUpload.uploading')
          : $t('media.photos.uploadN', pendingFiles.length, { named: { n: pendingFiles.length } }) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.add-photos {
  display: flex; flex-direction: column; gap: 0.75rem;
  padding: 1rem; margin-bottom: 1rem;
  border: 1px solid var(--c-2a2a2a); border-radius: 0.5rem;
}
</style>
