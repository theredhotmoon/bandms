<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { Author, AuthorPayload } from '@/types/author'
import type { PressReleaseSummary } from '@/types/press-release'
import type { Concert } from '@/types/concert'
import type { TourSummary } from '@/types/tour'

const props = defineProps<{
  initial?: Author | null
  loading?: boolean
  errors?: Record<string, string[]>
  pressReleases: PressReleaseSummary[]
  concerts: Concert[]
  tours: TourSummary[]
}>()

const emit = defineEmits<{
  submit: [payload: AuthorPayload]
  cancel: []
}>()

const form = reactive({
  name:      '',
  email:     '',
  facebook:  '',
  instagram: '',
  whatsapp:  '',
  phone:     '',
  notes:     '',
})

const press_release_ids = ref<number[]>([])
const concert_ids       = ref<number[]>([])
const tour_ids          = ref<number[]>([])

watch(
  () => props.initial,
  (val) => {
    form.name      = val?.name      ?? ''
    form.email     = val?.email     ?? ''
    form.facebook  = val?.facebook  ?? ''
    form.instagram = val?.instagram ?? ''
    form.whatsapp  = val?.whatsapp  ?? ''
    form.phone     = val?.phone     ?? ''
    form.notes     = val?.notes     ?? ''
    press_release_ids.value = val?.press_releases?.map((p) => p.id) ?? []
    concert_ids.value       = val?.concerts?.map((c) => c.id)       ?? []
    tour_ids.value          = val?.tours?.map((t) => t.id)           ?? []
  },
  { immediate: true },
)

const expandedSections = reactive({
  pressReleases: false,
  concerts:      false,
  tours:         false,
})

function toggle(arr: number[], id: number) {
  const i = arr.indexOf(id)
  if (i === -1) arr.push(id)
  else arr.splice(i, 1)
}

function sectionLabel(label: string, count: number) {
  return count ? `${label} (${count})` : label
}

function prLabel(pr: PressReleaseSummary) {
  return pr.og_title ?? pr.url
}

function concertLabel(c: Concert) {
  return c.date + (c.venue ? ` – ${c.venue.name}` : '')
}

function submit() {
  emit('submit', {
    name:               form.name,
    email:              form.email     || null,
    facebook:           form.facebook  || null,
    instagram:          form.instagram || null,
    whatsapp:           form.whatsapp  || null,
    phone:              form.phone     || null,
    notes:              form.notes     || null,
    press_release_ids:  press_release_ids.value,
    concert_ids:        concert_ids.value,
    tour_ids:           tour_ids.value,
    photo_ids:          [],
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">

    <!-- Name -->
    <div>
      <label class="field-label">Name <span class="field-req">*</span></label>
      <input v-model="form.name" required class="field-input" placeholder="Jane Smith" />
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>

    <!-- Contact details -->
    <div class="contact-grid">
      <div>
        <label class="field-label">Email</label>
        <input v-model="form.email" type="email" class="field-input" placeholder="jane@example.com" />
        <p v-if="errors?.email" class="field-error">{{ errors.email[0] }}</p>
      </div>
      <div>
        <label class="field-label">Phone</label>
        <input v-model="form.phone" class="field-input" placeholder="+48 123 456 789" />
      </div>
      <div>
        <label class="field-label">Facebook</label>
        <input v-model="form.facebook" class="field-input" placeholder="facebook.com/jane" />
      </div>
      <div>
        <label class="field-label">Instagram</label>
        <input v-model="form.instagram" class="field-input" placeholder="@jane or instagram.com/jane" />
      </div>
      <div>
        <label class="field-label">WhatsApp</label>
        <input v-model="form.whatsapp" class="field-input" placeholder="+48 123 456 789" />
      </div>
    </div>

    <!-- Notes -->
    <div>
      <label class="field-label">Notes <span class="hint">(optional)</span></label>
      <textarea v-model="form.notes" rows="3" class="field-input" placeholder="Additional context about this contact…" style="resize:vertical;" />
    </div>

    <!-- Press releases -->
    <div v-if="pressReleases.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expandedSections.pressReleases = !expandedSections.pressReleases">
        <svg class="assoc-chevron" :class="{ 'assoc-chevron--open': expandedSections.pressReleases }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        {{ sectionLabel('Press releases', press_release_ids.length) }}
      </button>
      <div v-if="expandedSections.pressReleases" class="assoc-list">
        <label v-for="pr in pressReleases" :key="pr.id" class="assoc-item">
          <input type="checkbox" :checked="press_release_ids.includes(pr.id)" @change="toggle(press_release_ids, pr.id)" class="assoc-check" />
          <span class="assoc-text">{{ prLabel(pr) }}</span>
        </label>
      </div>
    </div>

    <!-- Concerts -->
    <div v-if="concerts.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expandedSections.concerts = !expandedSections.concerts">
        <svg class="assoc-chevron" :class="{ 'assoc-chevron--open': expandedSections.concerts }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        {{ sectionLabel('Concerts', concert_ids.length) }}
      </button>
      <div v-if="expandedSections.concerts" class="assoc-list">
        <label v-for="c in concerts" :key="c.id" class="assoc-item">
          <input type="checkbox" :checked="concert_ids.includes(c.id)" @change="toggle(concert_ids, c.id)" class="assoc-check" />
          <span class="assoc-text">{{ concertLabel(c) }}</span>
        </label>
      </div>
    </div>

    <!-- Tours -->
    <div v-if="tours.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expandedSections.tours = !expandedSections.tours">
        <svg class="assoc-chevron" :class="{ 'assoc-chevron--open': expandedSections.tours }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        {{ sectionLabel('Tours', tour_ids.length) }}
      </button>
      <div v-if="expandedSections.tours" class="assoc-list">
        <label v-for="t in tours" :key="t.id" class="assoc-item">
          <input type="checkbox" :checked="tour_ids.includes(t.id)" @change="toggle(tour_ids, t.id)" class="assoc-check" />
          <span class="assoc-text">{{ t.name }}</span>
        </label>
      </div>
    </div>

    <div class="flex gap-2 justify-end pt-1">
      <button type="button" class="btn-ghost" @click="emit('cancel')">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem; }
.field-req  { color: #f87171; }
.hint       { font-weight: 400; text-transform: none; letter-spacing: 0; color: #334155; font-size: 0.65rem; }
.field-error { font-size: 0.72rem; color: #f87171; margin-top: 0.2rem; }

.assoc-section { border: 1px solid #222222; border-radius: 0.375rem; overflow: hidden; }
.assoc-toggle {
  width: 100%; display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.75rem; font-size: 0.8rem; font-weight: 500; color: #94a3b8;
  background: #141414; border: none; cursor: pointer; text-align: left;
  transition: color 120ms;
}
.assoc-toggle:hover { color: #e2e8f0; }
.assoc-chevron {
  width: 0.875rem; height: 0.875rem; flex-shrink: 0; transition: transform 150ms; color: #475569;
}
.assoc-chevron--open { transform: rotate(90deg); }
.assoc-list {
  max-height: 12rem; overflow-y: auto; padding: 0.375rem 0;
  border-top: 1px solid #222222; background: #0d0d0d;
}
.assoc-item {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.3rem 0.875rem; cursor: pointer; transition: background 80ms;
}
.assoc-item:hover { background: #1a1a1a; }
.assoc-check { accent-color: #888888; flex-shrink: 0; }
.assoc-text { font-size: 0.78rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
