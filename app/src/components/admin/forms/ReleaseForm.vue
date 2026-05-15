<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import RichEditor from '@/components/admin/RichEditor.vue'
import type { Release, ReleasePayload, ReleasePlatform, ReleaseType } from '@/types/release'

const props = defineProps<{
  initial?: Release | null
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{
  submit: [payload: ReleasePayload, coverFile: File | null, deleteCover: boolean]
  cancel: []
}>()

const PLATFORMS: { key: ReleasePlatform; label: string; color: string }[] = [
  { key: 'spotify',     label: 'Spotify',     color: '#1db954' },
  { key: 'apple_music', label: 'Apple Music', color: '#fc3c44' },
  { key: 'bandcamp',    label: 'Bandcamp',    color: '#1da0c3' },
  { key: 'youtube',     label: 'YouTube',     color: '#ff0000' },
  { key: 'instagram',   label: 'Instagram',   color: '#e1306c' },
]

const TYPES: ReleaseType[] = ['LP', 'EP', 'single', 'compilation']

const MUSICAL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm',
  'F#m', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm',
]

// ── Cover image ───────────────────────────────────────────────
const coverInput   = ref<HTMLInputElement | null>(null)
const coverFile    = ref<File | null>(null)
const coverPreview = ref<string | null>(null)
const coverDelete  = ref(false)

const existingCoverUrl = computed(() => props.initial?.cover_image ?? null)
const displayCover = computed(() =>
  coverPreview.value ?? (coverDelete.value ? null : existingCoverUrl.value),
)

function triggerCoverInput() { coverInput.value?.click() }

function setCoverFile(file: File) {
  coverFile.value   = file
  coverDelete.value = false
  const reader = new FileReader()
  reader.onload = (e) => { coverPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
}

function onCoverInputChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) setCoverFile(file)
}

function onCoverDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) setCoverFile(file)
}

function removeCover() {
  coverFile.value    = null
  coverPreview.value = null
  coverDelete.value  = true
}

// ── Track row ─────────────────────────────────────────────────
interface TrackRow {
  title:           string
  duration:        string
  lyrics:          string
  sort_order:      number
  bpm:             string
  musical_key:     string
  mood_tags:       string
  isrc:            string
  explicit:        boolean
  stems_available: boolean
  sync_placements: string
  links:           Record<ReleasePlatform, string>
  showMeta:        boolean
  showLyrics:      boolean
  showLinks:       boolean
}

function emptyLinks(): Record<ReleasePlatform, string> {
  return { spotify: '', apple_music: '', bandcamp: '', youtube: '', instagram: '' }
}

function emptyTrack(sort_order = 0): TrackRow {
  return {
    title: '', duration: '', lyrics: '', sort_order,
    bpm: '', musical_key: '', mood_tags: '', isrc: '',
    explicit: false, stems_available: false, sync_placements: '',
    links: emptyLinks(),
    showMeta: false, showLyrics: false, showLinks: false,
  }
}

// ── Form ──────────────────────────────────────────────────────
const form = reactive({
  title:        '',
  type:         'single' as ReleaseType,
  release_date: '',
  description:  '' as string,
  is_upcoming:  false,
  presave_url:  '',
  links:        emptyLinks(),
})

const tracks = ref<TrackRow[]>([emptyTrack(0)])

watch(
  () => props.initial,
  (val) => {
    if (!val) {
      form.title        = ''
      form.type         = 'single'
      form.release_date = ''
      form.description  = ''
      form.is_upcoming  = false
      form.presave_url  = ''
      form.links        = emptyLinks()
      tracks.value      = [emptyTrack(0)]
      coverFile.value    = null
      coverPreview.value = null
      coverDelete.value  = false
      return
    }
    form.title        = val.title
    form.type         = val.type
    form.release_date = val.release_date ?? ''
    form.description  = val.description ?? ''
    form.is_upcoming  = val.is_upcoming
    form.presave_url  = val.presave_url ?? ''
    const lm = emptyLinks()
    for (const l of val.links) lm[l.platform] = l.url
    form.links = lm
    tracks.value = val.tracks.map(t => {
      const tlm = emptyLinks()
      for (const l of t.links) tlm[l.platform] = l.url
      return {
        title:           t.title,
        duration:        t.duration        ?? '',
        lyrics:          t.lyrics          ?? '',
        sort_order:      t.sort_order,
        bpm:             t.bpm != null ? String(t.bpm) : '',
        musical_key:     t.musical_key     ?? '',
        mood_tags:       t.mood_tags       ?? '',
        isrc:            t.isrc            ?? '',
        explicit:        t.explicit,
        stems_available: t.stems_available,
        sync_placements: t.sync_placements ?? '',
        links:           tlm,
        showMeta:   false,
        showLyrics: false,
        showLinks:  false,
      }
    })
    if (tracks.value.length === 0) tracks.value = [emptyTrack(0)]
    coverFile.value    = null
    coverPreview.value = null
    coverDelete.value  = false
  },
  { immediate: true },
)

function addTrack() {
  tracks.value.push(emptyTrack(tracks.value.length))
}

function removeTrack(i: number) {
  tracks.value.splice(i, 1)
}

function handleSubmit() {
  const payload: ReleasePayload = {
    title:        form.title,
    type:         form.type,
    release_date: form.release_date || null,
    description:  form.description  || null,
    is_upcoming:  form.is_upcoming,
    presave_url:  form.is_upcoming ? (form.presave_url || null) : null,
    links: PLATFORMS
      .filter(p => form.links[p.key])
      .map(p => ({ platform: p.key, url: form.links[p.key] })),
    tracks: tracks.value.map((t, i) => ({
      title:           t.title,
      duration:        t.duration || null,
      lyrics:          t.lyrics   || null,
      sort_order:      i,
      bpm:             t.bpm ? Number(t.bpm) : null,
      musical_key:     t.musical_key     || null,
      mood_tags:       t.mood_tags       || null,
      isrc:            t.isrc            || null,
      explicit:        t.explicit,
      stems_available: t.stems_available,
      sync_placements: t.sync_placements || null,
      links: PLATFORMS
        .filter(p => t.links[p.key])
        .map(p => ({ platform: p.key, url: t.links[p.key] })),
    })),
  }
  emit('submit', payload, coverFile.value, coverDelete.value)
}
</script>

<template>
  <form @submit.prevent="handleSubmit">

    <!-- Cover + basic info -->
    <div class="grid grid-cols-[8rem_1fr] gap-4 mb-5">
      <div>
        <label class="field-label">Cover</label>
        <div
          class="cover-drop"
          :class="{ 'has-image': !!displayCover }"
          @click="triggerCoverInput"
          @dragover.prevent
          @drop="onCoverDrop"
        >
          <img v-if="displayCover" :src="displayCover" class="cover-img" alt="Cover" />
          <div v-else class="cover-placeholder">
            <svg class="cover-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span class="cover-hint">Click or drop</span>
          </div>
        </div>
        <button v-if="displayCover" type="button" class="btn-add mt-1" @click.stop="removeCover">Remove</button>
        <input ref="coverInput" type="file" accept="image/*" style="display:none" @change="onCoverInputChange" />
      </div>

      <div class="flex flex-col gap-3">
        <div>
          <label class="field-label">Title <span class="field-req">*</span></label>
          <input v-model="form.title" required class="field-input" placeholder="Release title" />
          <p v-if="errors?.title" class="field-error">{{ errors.title[0] }}</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Type</label>
            <select v-model="form.type" class="field-input">
              <option v-for="t in TYPES" :key="t" :value="t">{{ t.toUpperCase() }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">Release date</label>
            <input v-model="form.release_date" type="date" class="field-input" />
          </div>
        </div>
        <div class="upcoming-block">
          <label class="toggle-row">
            <input type="checkbox" v-model="form.is_upcoming" class="toggle-check" />
            <span class="toggle-track"><span class="toggle-thumb" /></span>
            <span class="toggle-label">Upcoming — show pre-save button</span>
          </label>
          <div v-if="form.is_upcoming" class="mt-2">
            <label class="field-label">Pre-save URL</label>
            <input v-model="form.presave_url" type="url" class="field-input" placeholder="https://distrokid.com/hyperfollow/…" />
          </div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="mb-5">
      <label class="field-label">Description</label>
      <RichEditor v-model="form.description" placeholder="Optional release notes or liner notes…" />
    </div>

    <!-- Streaming links -->
    <div class="mb-5">
      <div class="section-title">Streaming links</div>
      <div class="flex flex-col gap-2">
        <div v-for="p in PLATFORMS" :key="p.key" class="platform-row">
          <span class="platform-dot" :style="`background:${p.color};`" />
          <span class="platform-name">{{ p.label }}</span>
          <input v-model="form.links[p.key]" class="field-input flex-1" :placeholder="`${p.label} URL…`" />
        </div>
      </div>
    </div>

    <!-- Tracks -->
    <div class="mb-5">
      <div class="flex items-center justify-between mb-2">
        <div class="section-title" style="margin-bottom:0;">Tracks</div>
        <button type="button" class="btn-add" @click="addTrack">+ Add track</button>
      </div>
      <div class="flex flex-col gap-2">
        <div v-for="(track, i) in tracks" :key="i" class="track-block">
          <div class="track-header">
            <span class="track-num">{{ i + 1 }}</span>
            <input v-model="track.title" class="field-input flex-1" :placeholder="`Track ${i + 1} title`" />
            <input v-model="track.duration" class="field-input track-dur" placeholder="3:42" />
            <button type="button" class="track-toggle-btn" :class="{ 'track-toggle-btn--has': track.showMeta }"
              @click="track.showMeta = !track.showMeta">Meta</button>
            <button type="button" class="track-toggle-btn" :class="{ 'track-toggle-btn--has': track.showLyrics }"
              @click="track.showLyrics = !track.showLyrics">Lyrics</button>
            <button type="button" class="track-toggle-btn" :class="{ 'track-toggle-btn--has': track.showLinks }"
              @click="track.showLinks = !track.showLinks">Links</button>
            <button type="button" class="track-remove" @click="removeTrack(i)">✕</button>
          </div>

          <div v-if="track.showMeta" class="track-panel">
            <div class="grid grid-cols-3 gap-2 mb-2">
              <div>
                <label class="field-label">BPM</label>
                <input v-model="track.bpm" type="number" min="1" max="400" class="field-input" placeholder="120" />
              </div>
              <div>
                <label class="field-label">Key</label>
                <select v-model="track.musical_key" class="field-input">
                  <option value="">—</option>
                  <option v-for="k in MUSICAL_KEYS" :key="k" :value="k">{{ k }}</option>
                </select>
              </div>
              <div>
                <label class="field-label">ISRC</label>
                <input v-model="track.isrc" class="field-input" placeholder="USRC12345678" />
              </div>
            </div>
            <div class="mb-2">
              <label class="field-label">Mood tags</label>
              <input v-model="track.mood_tags" class="field-input" placeholder="dark, energetic, melancholic…" />
            </div>
            <div class="mb-2">
              <label class="field-label">Sync placements</label>
              <input v-model="track.sync_placements" class="field-input" placeholder="Netflix S2E4, Nike ad…" />
            </div>
            <div class="flex gap-4">
              <label class="toggle-row toggle-row--small">
                <input type="checkbox" v-model="track.explicit" class="toggle-check" />
                <span class="toggle-track"><span class="toggle-thumb" /></span>
                <span class="toggle-label">Explicit</span>
              </label>
              <label class="toggle-row toggle-row--small">
                <input type="checkbox" v-model="track.stems_available" class="toggle-check" />
                <span class="toggle-track"><span class="toggle-thumb" /></span>
                <span class="toggle-label">Stems available</span>
              </label>
            </div>
          </div>

          <div v-if="track.showLyrics" class="track-panel">
            <label class="field-label" style="margin-bottom:0.25rem;">Lyrics</label>
            <textarea v-model="track.lyrics" class="lyrics-textarea" placeholder="Paste lyrics here…" rows="8" />
          </div>

          <div v-if="track.showLinks" class="track-panel track-links-panel">
            <div class="track-links-hint">Per-track streaming links (optional)</div>
            <div v-for="p in PLATFORMS" :key="p.key" class="platform-row platform-row--compact">
              <span class="platform-dot" :style="`background:${p.color};`" />
              <span class="platform-name">{{ p.label }}</span>
              <input v-model="track.links[p.key]" class="field-input flex-1" :placeholder="`${p.label} URL…`" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update release' : 'Create release') }}
      </button>
    </div>

  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.section-title {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: #64748b; margin-bottom: 0.625rem;
}
.platform-row  { display: flex; align-items: center; gap: 0.625rem; }
.platform-row--compact { gap: 0.5rem; }
.platform-dot  { width: 0.5rem; height: 0.5rem; border-radius: 9999px; flex-shrink: 0; }
.platform-name { font-size: 0.75rem; font-weight: 500; color: #94a3b8; width: 7rem; flex-shrink: 0; }

.upcoming-block { display: flex; flex-direction: column; justify-content: flex-end; }

/* ── Toggle ──────────────────────────────────────────────────── */
.toggle-row { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none; }
.toggle-row--small { gap: 0.375rem; }
.toggle-check { display: none; }
.toggle-track {
  width: 2rem; height: 1rem; border-radius: 9999px; background: #1a1a38;
  position: relative; flex-shrink: 0; transition: background 150ms;
  border: 1px solid #1e2040;
}
.toggle-check:checked + .toggle-track { background: #4f46e5; border-color: #4f46e5; }
.toggle-thumb {
  position: absolute; top: 1px; left: 1px; width: 0.625rem; height: 0.625rem;
  border-radius: 9999px; background: #475569; transition: transform 150ms, background 150ms;
}
.toggle-check:checked + .toggle-track .toggle-thumb { transform: translateX(1rem); background: #fff; }
.toggle-label { font-size: 0.8125rem; color: #94a3b8; }

/* ── Cover drop ──────────────────────────────────────────────── */
.cover-drop {
  border: 2px dashed #1e2040; border-radius: 0.5rem;
  background: #0e0e26; cursor: pointer; overflow: hidden;
  transition: border-color 150ms, background 150ms;
  min-height: 120px; display: flex; align-items: center; justify-content: center;
}
.cover-drop:hover { border-color: #6366f1; background: #0d0d22; }
.cover-drop.has-image { border-style: solid; border-color: #1e2040; min-height: 0; }
.cover-img { display: block; width: 100%; max-height: 240px; object-fit: contain; background: #050510; }
.cover-placeholder { display: flex; flex-direction: column; align-items: center; gap: 0.375rem; padding: 1.5rem; }
.cover-icon { width: 2rem; height: 2rem; color: #334155; }
.cover-hint { font-size: 0.8125rem; color: #475569; }

/* ── Tracks ──────────────────────────────────────────────────── */
.track-block { border: 1px solid #1e2040; border-radius: 0.5rem; overflow: hidden; }
.track-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.625rem; background: #0e0e26; }
.track-num { font-size: 0.75rem; font-weight: 600; color: #475569; width: 1.25rem; text-align: center; flex-shrink: 0; }
.track-dur { max-width: 5rem; }
.track-toggle-btn {
  padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #475569;
  transition: background 120ms, border-color 120ms, color 120ms; flex-shrink: 0;
}
.track-toggle-btn:hover { background: #16163a; border-color: #252350; color: #94a3b8; }
.track-toggle-btn--has  { border-color: #252350; color: #818cf8; }
.track-remove {
  padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.75rem;
  cursor: pointer; background: transparent; border: 1px solid #2d1212; color: #f87171;
  transition: background 120ms; flex-shrink: 0;
}
.track-remove:hover { background: #2d1010; }

.track-panel { padding: 0.625rem 0.875rem; border-top: 1px solid #1a1a3a; background: #0b0b20; }
.track-links-panel { display: flex; flex-direction: column; gap: 0.375rem; }
.track-links-hint { font-size: 0.7rem; color: #475569; margin-bottom: 0.375rem; }

.lyrics-textarea {
  width: 100%; background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.375rem;
  color: #e2e8f0; font-size: 0.8125rem; padding: 0.5rem 0.625rem; outline: none;
  font-family: 'Courier New', monospace; line-height: 1.6; resize: vertical;
  transition: border-color 150ms, box-shadow 150ms;
}
.lyrics-textarea:focus {
  border-color: #5154e5;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
}
</style>
