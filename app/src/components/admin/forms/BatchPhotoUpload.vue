<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import ImageDropZone from './ImageDropZone.vue'
import type { Concert } from '@/types/concert'
import type { Venue } from '@/types/venue'
import type { Tag } from '@/types/tag'
import type { UploadProgress } from '@/api/albums'

const props = defineProps<{
  venues: Venue[]
  concerts: Concert[]
  tags: Tag[]
  uploading?: boolean
  progress?: UploadProgress | null
}>()

const emit = defineEmits<{
  upload: [files: { file: File; caption: string }[], meta: {
    title: string
    description: string | null
    venue_id: number | null
    concert_id: number | null
    taken_at: string | null
    published_at: string | null
    tag_ids: number[]
  }]
  cancel: []
}>()

const pendingFiles = ref<{ file: File; caption: string }[]>([])

const meta = reactive({
  title:        '',
  description:  '',
  venue_id:     '' as string,
  concert_id:   '' as string,
  taken_at:     '',
  published_at: new Date().toISOString().slice(0, 16),
  tag_ids:      [] as number[],
})

watch(() => meta.concert_id, (id) => {
  if (!id) return
  const concert = props.concerts.find((c) => String(c.id) === id)
  if (concert?.date) {
    meta.taken_at = concert.date + 'T00:00'
    if (!meta.title) {
      meta.title = concert.date + (concert.venue?.name ? ` — ${concert.venue.name}` : '')
    }
  }
})

function toggleTag(id: number) {
  const idx = meta.tag_ids.indexOf(id)
  if (idx === -1) meta.tag_ids.push(id)
  else meta.tag_ids.splice(idx, 1)
}

const canUpload = computed(() =>
  pendingFiles.value.length > 0 && !!meta.title.trim() && !props.uploading,
)
const progressPct = computed(() => props.progress?.percent ?? 0)

function submit() {
  emit('upload',
    pendingFiles.value,
    {
      title:        meta.title.trim(),
      description:  meta.description.trim() || null,
      venue_id:     meta.venue_id ? parseInt(meta.venue_id) : null,
      concert_id:   meta.concert_id ? parseInt(meta.concert_id) : null,
      taken_at:     meta.taken_at || null,
      published_at: meta.published_at || null,
      tag_ids:      meta.tag_ids,
    },
  )
}
</script>

<template>
  <div class="batch-upload">

    <!-- Album metadata -->
    <div class="album-meta">
      <div class="meta-full">
        <label class="field-label">Album title <span style="color:#f87171;">*</span></label>
        <input v-model="meta.title" class="field-input" placeholder="e.g. Rudeboy 2026-05-08" />
      </div>
      <div class="meta-row">
        <div class="meta-field">
          <label class="field-label">Concert</label>
          <select v-model="meta.concert_id" class="field-input">
            <option value="">— none —</option>
            <option v-for="c in concerts" :key="c.id" :value="String(c.id)">
              {{ c.date }} — {{ c.venue?.name }}
            </option>
          </select>
        </div>
        <div class="meta-field">
          <label class="field-label">Venue</label>
          <select v-model="meta.venue_id" class="field-input">
            <option value="">— none —</option>
            <option v-for="v in venues" :key="v.id" :value="String(v.id)">{{ v.name }}</option>
          </select>
        </div>
      </div>
      <div class="meta-row">
        <div class="meta-field">
          <label class="field-label">Taken at</label>
          <input v-model="meta.taken_at" type="datetime-local" class="field-input" />
        </div>
        <div class="meta-field">
          <label class="field-label">Publish at</label>
          <input v-model="meta.published_at" type="datetime-local" class="field-input" />
        </div>
      </div>
      <div>
        <label class="field-label">Description</label>
        <textarea v-model="meta.description" class="field-input" rows="2" placeholder="Optional notes about this album" />
      </div>
      <div v-if="tags.length">
        <label class="field-label">Tags</label>
        <div class="checkbox-list">
          <label v-for="t in tags" :key="t.id" class="checkbox-item">
            <input type="checkbox" :checked="meta.tag_ids.includes(t.id)" @change="toggleTag(t.id)" />
            <span>{{ t.name }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="section-divider">Photos</div>

    <ImageDropZone :uploading="uploading" @change="pendingFiles = $event" />

    <!-- Progress -->
    <div v-if="uploading" class="progress-wrap">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPct + '%' }" />
      </div>
      <span class="progress-label">Uploading… {{ progressPct }}%</span>
    </div>

    <!-- Footer -->
    <div class="flex gap-2 justify-end pt-2">
      <button type="button" @click="$emit('cancel')" class="btn-ghost" :disabled="uploading">Cancel</button>
      <button type="button" :disabled="!canUpload" class="btn-primary" @click="submit">
        {{ uploading
          ? 'Uploading…'
          : `Create album (${pendingFiles.length} photo${pendingFiles.length !== 1 ? 's' : ''})` }}
      </button>
    </div>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.batch-upload  { display: flex; flex-direction: column; gap: 1rem; }
.album-meta    { display: flex; flex-direction: column; gap: 0.75rem; }
.meta-full     { display: flex; flex-direction: column; gap: 0.25rem; }
.meta-row      { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.meta-field    { display: flex; flex-direction: column; gap: 0.25rem; }

.section-divider {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
  border-top: 1px solid #252525;
  padding-top: 0.75rem;
}

.progress-wrap  { display: flex; flex-direction: column; gap: 0.35rem; }
.progress-bar   { height: 5px; background: #252525; border-radius: 9999px; overflow: hidden; }
.progress-fill  { height: 100%; background: #888888; border-radius: 9999px; transition: width 0.2s ease; }
.progress-label { font-size: 0.72rem; color: #94a3b8; text-align: center; }
</style>
