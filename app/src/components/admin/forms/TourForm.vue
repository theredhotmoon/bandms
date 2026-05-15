<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import RichEditor from '@/components/admin/RichEditor.vue'
import { useConcerts } from '@/composables/useConcerts'
import type { Tour, TourPayload } from '@/types/tour'

const props = defineProps<{
  initial?: Tour | null
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [TourPayload]; cancel: [] }>()

const { query: concertsQuery } = useConcerts()

const form = reactive({
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  poster: '',
})

const selectedConcertIds = ref<Set<number>>(new Set())

interface ImageRow { url: string; caption: string; sort_order: number }
interface LinkRow  { label: string; url: string }

const images = ref<ImageRow[]>([])
const links  = ref<LinkRow[]>([])

watch(
  () => props.initial,
  (val) => {
    form.name        = val?.name ?? ''
    form.description = val?.description ?? ''
    form.start_date  = val?.start_date ?? ''
    form.end_date    = val?.end_date ?? ''
    form.poster      = val?.poster ?? ''

    selectedConcertIds.value = new Set(val?.concerts?.map((c) => c.id) ?? [])

    images.value = (val?.images ?? []).map((img) => ({
      url:        img.url,
      caption:    img.caption ?? '',
      sort_order: img.sort_order,
    }))

    links.value = (val?.links ?? []).map((l) => ({ label: l.label, url: l.url }))
  },
  { immediate: true },
)

function toggleConcert(id: number) {
  if (selectedConcertIds.value.has(id)) selectedConcertIds.value.delete(id)
  else selectedConcertIds.value.add(id)
}

function addImage() {
  images.value.push({ url: '', caption: '', sort_order: images.value.length })
}

function removeImage(i: number) {
  images.value.splice(i, 1)
  images.value.forEach((img, idx) => { img.sort_order = idx })
}

function moveImage(from: number, to: number) {
  const item = images.value.splice(from, 1)[0]
  images.value.splice(to, 0, item)
  images.value.forEach((img, idx) => { img.sort_order = idx })
}

function addLink() {
  links.value.push({ label: '', url: '' })
}

function removeLink(i: number) {
  links.value.splice(i, 1)
}

function submit() {
  emit('submit', {
    name:        form.name,
    description: form.description || null,
    start_date:  form.start_date || null,
    end_date:    form.end_date || null,
    poster:      form.poster || null,
    concert_ids: Array.from(selectedConcertIds.value),
    images: images.value.map((img, i) => ({
      url:        img.url,
      caption:    img.caption || null,
      sort_order: i,
    })),
    links: links.value.map((l) => ({ label: l.label, url: l.url })),
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-5">

    <!-- Name -->
    <div>
      <label class="field-label">Tour name <span style="color:#f87171;">*</span></label>
      <input v-model="form.name" required class="field-input" placeholder="e.g. Summer Skanking Tour 2025" />
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>

    <!-- Dates + Poster -->
    <div class="grid grid-cols-3 gap-3">
      <div>
        <label class="field-label">Start date</label>
        <input v-model="form.start_date" type="date" class="field-input" />
        <p v-if="errors?.start_date" class="field-error">{{ errors.start_date[0] }}</p>
      </div>
      <div>
        <label class="field-label">End date</label>
        <input v-model="form.end_date" type="date" class="field-input" />
        <p v-if="errors?.end_date" class="field-error">{{ errors.end_date[0] }}</p>
      </div>
      <div>
        <label class="field-label">Poster URL</label>
        <input v-model="form.poster" class="field-input" placeholder="https://…" />
        <p v-if="errors?.poster" class="field-error">{{ errors.poster[0] }}</p>
      </div>
    </div>

    <!-- Description -->
    <div>
      <label class="field-label">Description</label>
      <RichEditor v-model="form.description" placeholder="Describe this tour…" />
      <p v-if="errors?.description" class="field-error">{{ errors.description[0] }}</p>
    </div>

    <!-- Concerts -->
    <div>
      <div class="section-title">
        Concerts
        <span v-if="selectedConcertIds.size" class="count-badge">{{ selectedConcertIds.size }} selected</span>
      </div>
      <div v-if="concertsQuery.isPending.value" class="text-xs" style="color:#475569;">Loading concerts…</div>
      <div v-else-if="!concertsQuery.data.value?.length" class="text-xs" style="color:#475569;">No concerts available.</div>
      <div v-else class="concerts-list">
        <label
          v-for="c in concertsQuery.data.value"
          :key="c.id"
          class="concert-item"
          :class="{ 'concert-item--selected': selectedConcertIds.has(c.id) }"
        >
          <input
            type="checkbox"
            class="concert-checkbox"
            :checked="selectedConcertIds.has(c.id)"
            @change="toggleConcert(c.id)"
          />
          <span class="concert-date">{{ c.date }}</span>
          <span class="concert-venue">{{ c.venue?.name ?? 'No venue' }}</span>
          <span v-if="c.description" class="concert-desc">{{ c.description }}</span>
        </label>
      </div>
    </div>

    <!-- Additional images -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="section-title mb-0">
          Additional images
          <span v-if="images.length" class="count-badge">{{ images.length }}</span>
        </div>
        <button type="button" @click="addImage" class="btn-add-row">+ Add image</button>
      </div>

      <div v-if="!images.length" class="empty-hint">No additional images.</div>
      <div class="rows-list">
        <div v-for="(img, i) in images" :key="i" class="img-row">
          <span class="row-num">{{ i + 1 }}</span>
          <input v-model="img.url" required class="field-input flex-1" placeholder="Image URL" />
          <input v-model="img.caption" class="field-input caption-input" placeholder="Caption (optional)" />
          <div class="move-group">
            <button type="button" class="move-btn" :disabled="i === 0" @click="moveImage(i, i - 1)" title="Up">↑</button>
            <button type="button" class="move-btn" :disabled="i === images.length - 1" @click="moveImage(i, i + 1)" title="Down">↓</button>
          </div>
          <button type="button" class="remove-btn" @click="removeImage(i)" title="Remove">✕</button>
        </div>
      </div>
    </div>

    <!-- Additional links -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="section-title mb-0">
          Additional links
          <span v-if="links.length" class="count-badge">{{ links.length }}</span>
        </div>
        <button type="button" @click="addLink" class="btn-add-row">+ Add link</button>
      </div>

      <div v-if="!links.length" class="empty-hint">No additional links.</div>
      <div class="rows-list">
        <div v-for="(link, i) in links" :key="i" class="link-row">
          <input v-model="link.label" required class="field-input label-input" placeholder="Label (e.g. Tickets)" />
          <input v-model="link.url" required class="field-input flex-1" placeholder="https://…" />
          <button type="button" class="remove-btn" @click="removeLink(i)" title="Remove">✕</button>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update tour' : 'Create tour') }}
      </button>
    </div>

  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.section-title {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: #34d399; margin-bottom: 0.625rem;
}
.count-badge {
  display: inline-block; padding: 0.1rem 0.375rem; border-radius: 0.25rem;
  background: #1e1b4b; color: #818cf8; font-size: 0.65rem; font-weight: 700;
  text-transform: none; letter-spacing: 0; margin-left: 0.375rem; vertical-align: middle;
}
/* Concerts list */
.concerts-list {
  max-height: 12rem; overflow-y: auto; border: 1px solid #1e2040;
  border-radius: 0.5rem; background: #0e0e26;
}
.concert-item {
  display: flex; align-items: center; gap: 0.625rem; cursor: pointer;
  padding: 0.4rem 0.75rem; border-bottom: 1px solid #0f0f26;
  transition: background 100ms;
}
.concert-item:last-child { border-bottom: none; }
.concert-item:hover { background: #0f0f26; }
.concert-item--selected { background: #1e1b4b; }
.concert-item--selected:hover { background: #231e5a; }
.concert-checkbox { accent-color: #6366f1; flex-shrink: 0; cursor: pointer; }
.concert-date {
  font-size: 0.75rem; font-weight: 600; color: #818cf8;
  white-space: nowrap; flex-shrink: 0; font-variant-numeric: tabular-nums;
}
.concert-venue { font-size: 0.75rem; color: #e2e8f0; flex: 1; min-width: 0; }
.concert-desc {
  font-size: 0.7rem; color: #64748b; max-width: 12rem;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* Shared row styles */
.btn-add-row {
  padding: 0.25rem 0.625rem; border-radius: 0.375rem; font-size: 0.75rem;
  font-weight: 600; cursor: pointer; background: #1e1b4b;
  border: 1px solid #312e81; color: #a5b4fc; transition: background 100ms;
}
.btn-add-row:hover { background: #1e2040; }
.empty-hint { font-size: 0.8125rem; color: #475569; padding: 0.375rem 0; }
.rows-list { display: flex; flex-direction: column; gap: 0.375rem; }
.img-row, .link-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.375rem 0.5rem; border-radius: 0.375rem;
  background: #0b0b20; border: 1px solid #1a1a38;
}
.row-num {
  font-size: 0.7rem; font-weight: 600; color: #334155;
  width: 1.25rem; text-align: right; flex-shrink: 0;
}
.caption-input { width: 11rem; flex-shrink: 0; }
.label-input   { width: 9rem; flex-shrink: 0; }
.move-group { display: flex; gap: 0.125rem; flex-shrink: 0; }
.move-btn {
  width: 1.5rem; height: 1.5rem; border-radius: 0.25rem; border: 1px solid #1a1a38;
  background: transparent; color: #475569; font-size: 0.75rem; cursor: pointer;
  transition: background 100ms, color 100ms; display: flex; align-items: center; justify-content: center;
}
.move-btn:hover:not(:disabled) { background: #0f0f26; color: #94a3b8; }
.move-btn:disabled { opacity: 0.25; cursor: default; }
.remove-btn {
  width: 1.5rem; height: 1.5rem; border-radius: 0.25rem; border: 1px solid #3a1212;
  background: transparent; color: #f87171; font-size: 0.65rem; cursor: pointer;
  transition: background 100ms; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
}
.remove-btn:hover { background: #3f1212; }
</style>
