<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import RichEditor from '@/components/admin/RichEditor.vue'
import TranslatedSlugInput from '@/components/admin/forms/TranslatedSlugInput.vue'
import { useI18n } from 'vue-i18n'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { useContentLocales } from '@/composables/useContentLocales'
import { LOCALES, bagFrom, bagHasText, compactBag, emptyBag, shortLabel, slugPayload, type Lang } from '@/locales'
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

const { t } = useI18n()

// Locales whose slug still follows the title — sent as null so the API generates them.
const slugAuto = ref<Partial<Record<Lang, boolean>>>({})
const { order: contentLocales, isPrimary } = useContentLocales()

// Sample text written in each input's own language — see PostForm.
const titlePlaceholder = (l: Lang): string => t('media.releaseForm.titlePlaceholder', {}, { locale: l })
const descriptionPlaceholder = (l: Lang): string => t('media.releaseForm.descriptionPlaceholder', {}, { locale: l })

// i18n-ignore block: `label` is a brand name and `color` is that brand's
// hex — neither translates. `key` is the persisted ReleasePlatform.
const PLATFORMS: { key: ReleasePlatform; label: string; color: string }[] = [
  { key: 'spotify',     label: 'Spotify',     color: '#1db954' }, // i18n-ignore: brand
  { key: 'apple_music', label: 'Apple Music', color: '#fc3c44' }, // i18n-ignore: brand
  { key: 'bandcamp',    label: 'Bandcamp',    color: '#1da0c3' }, // i18n-ignore: brand
  { key: 'youtube',     label: 'YouTube',     color: '#ff0000' }, // i18n-ignore: brand
  { key: 'instagram',   label: 'Instagram',   color: '#e1306c' }, // i18n-ignore: brand
]

const TYPES: ReleaseType[] = ['LP', 'EP', 'single', 'compilation'] // i18n-ignore: persisted ReleaseType values

// International pitch notation, stored verbatim in track.musical_key. It is
// data, and it is the same notation a Polish engineer reads.
const MUSICAL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', // i18n-ignore: pitch notation
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', // i18n-ignore: pitch notation
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', // i18n-ignore: pitch notation
  'F#m', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm', // i18n-ignore: pitch notation
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
  title:        emptyBag(),
  slug:         emptyBag(),
  type:         'single' as ReleaseType,
  release_date: '',
  description:  emptyBag(),
  is_upcoming:  false,
  presave_url:  '',
  label_name:   '',
  links:        emptyLinks(),
})

const tracks = ref<TrackRow[]>([emptyTrack(0)])

const { isDirty, markClean } = useDirtyGuard(() => ({ ...form, tracks: tracks.value }))
const canSave = computed(() => isDirty.value || coverFile.value !== null || coverDelete.value)

watch(
  () => props.initial,
  (val) => {
    if (!val) {
      form.title          = emptyBag()
      form.slug           = emptyBag()
      form.type           = 'single'
      form.release_date   = ''
      form.description    = emptyBag()
      form.is_upcoming    = false
      form.presave_url    = ''
      form.label_name     = ''
      form.links          = emptyLinks()
      tracks.value        = [emptyTrack(0)]
      coverFile.value     = null
      coverPreview.value  = null
      coverDelete.value   = false
      markClean()
      return
    }
    form.title          = bagFrom(val.translations?.title, val.title)
    form.slug           = bagFrom(val.translations?.slug)
    form.type           = val.type
    form.release_date   = val.release_date ?? ''
    form.description    = bagFrom(val.translations?.description, val.description)
    form.is_upcoming    = val.is_upcoming
    form.presave_url    = val.presave_url ?? ''
    form.label_name     = val.label_name ?? ''
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
    markClean()
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
    // `{}` when blank, so the API's required rule answers with a `title` error.
    title:       bagHasText(form.title) ? compactBag(form.title) : {},
    // On edit, send every locale exactly as shown: the API generates a missing
    // non-default slug on CREATE only, so a previewed Polish slug sent as
    // null (auto) was dropped — the form showed a slug it never saved (#153's
    // review). On create, auto locales go as null so the API generates them.
    slug:        slugPayload(form.slug, props.initial ? {} : slugAuto.value),
    type:         form.type,
    release_date: form.release_date || null,
    description: compactBag(form.description),
    is_upcoming:  form.is_upcoming,
    presave_url:  form.is_upcoming ? (form.presave_url || null) : null,
    label_name:   form.label_name || null,
    links: PLATFORMS
      .filter(p => form.links[p.key])
      .map(p => ({ platform: p.key, url: form.links[p.key] })),
    tracks: tracks.value.filter(t => t.title.trim() !== '').map((t, i) => ({
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
        <label class="field-label">{{ $t('media.releaseForm.cover') }}</label>
        <div
          class="cover-drop"
          :class="{ 'has-image': !!displayCover }"
          @click="triggerCoverInput"
          @dragover.prevent
          @drop="onCoverDrop"
        >
          <img v-if="displayCover" :src="displayCover" class="cover-img" :alt="$t('media.releaseForm.cover')" />
          <div v-else class="cover-placeholder">
            <svg class="cover-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span class="cover-hint">{{ $t('media.releaseForm.coverDrop') }}</span>
          </div>
        </div>
        <button v-if="displayCover" type="button" class="btn-add mt-1" @click.stop="removeCover">{{ $t('media.releaseForm.coverRemove') }}</button>
        <input ref="coverInput" type="file" accept="image/*" style="display:none" @change="onCoverInputChange" />
      </div>

      <div class="flex flex-col gap-3">
        <div>
          <label class="field-label">{{ $t('media.releaseForm.title') }} <span class="field-req">*</span></label>
          <div class="trans-group">
            <div v-for="l in contentLocales" :key="l" class="trans-row" :data-locale="l">
              <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
              <input v-model="form.title[l]" :required="isPrimary(l) && !bagHasText(form.title)" class="field-input flex-1" :placeholder="titlePlaceholder(l)" />
            </div>
          </div>
          <p v-if="errors?.title" class="field-error">{{ errors.title[0] }}</p>
        </div>
        <div>
          <label class="field-label">{{ $t('common.fields.slug') }}</label>
          <!-- Each locale follows its own title on a new release; a loaded
               slug stays fixed (no followLoaded) so a retitle never re-slugs. -->
          <TranslatedSlugInput
            v-model="form.slug"
            :editing="!!initial"
            v-model:auto="slugAuto"
            :sources="form.title"
            :errors="Object.fromEntries(LOCALES.map(l => [l, errors?.[`slug.${l}`]?.[0]]))"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">{{ $t('media.releaseForm.type') }}</label>
            <select v-model="form.type" class="field-input">
              <option v-for="rt in TYPES" :key="rt" :value="rt">{{ $t(`media.releases.types.${rt}`) }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">{{ $t('media.releaseForm.releaseDate') }}</label>
            <input v-model="form.release_date" type="date" class="field-input" />
          </div>
        </div>
        <div class="upcoming-block">
          <label class="toggle-row">
            <input type="checkbox" v-model="form.is_upcoming" class="toggle-check" />
            <span class="toggle-track"><span class="toggle-thumb" /></span>
            <span class="toggle-label">{{ $t('media.releaseForm.upcoming') }}</span>
          </label>
          <div v-if="form.is_upcoming" class="mt-2">
            <label class="field-label">{{ $t('media.releaseForm.presaveUrl') }}</label>
            <input v-model="form.presave_url" type="url" class="field-input" :placeholder="$t('media.releaseForm.presavePlaceholder')" />
          </div>
        </div>
      </div>
    </div>

    <!-- Label name -->
    <div class="mb-4">
      <label class="field-label">{{ $t('media.releaseForm.label') }}</label>
      <input v-model="form.label_name" class="field-input" :placeholder="$t('media.releaseForm.labelPlaceholder')" />
      <p v-if="errors?.label_name" class="field-error">{{ errors.label_name[0] }}</p>
    </div>

    <!-- Description -->
    <div class="mb-5">
      <label class="field-label">{{ $t('media.releaseForm.description') }}</label>
      <div class="trans-group">
        <div v-for="l in contentLocales" :key="l" class="trans-row trans-row--top" :data-locale="l">
          <span class="lang-badge" :class="`lang-badge--${l}`" style="margin-top:0.5rem;">{{ shortLabel(l) }}</span>
          <div class="flex-1">
            <RichEditor v-model="form.description[l]" :placeholder="descriptionPlaceholder(l)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Streaming links -->
    <div class="mb-5">
      <div class="section-title">{{ $t('media.releaseForm.streaming') }}</div>
      <div class="flex flex-col gap-2">
        <div v-for="p in PLATFORMS" :key="p.key" class="platform-row">
          <span class="platform-dot" :style="`background:${p.color};`" />
          <span class="platform-name">{{ p.label }}</span>
          <input v-model="form.links[p.key]" class="field-input flex-1" :placeholder="$t('media.releaseForm.urlPlaceholder', { platform: p.label })" />
        </div>
      </div>
    </div>

    <!-- Tracks -->
    <div class="mb-5">
      <div class="flex items-center justify-between mb-2">
        <div class="section-title" style="margin-bottom:0;">{{ $t('media.releaseForm.tracks') }}</div>
        <button type="button" class="btn-add" @click="addTrack">{{ $t('media.releaseForm.addTrack') }}</button>
      </div>
      <div class="flex flex-col gap-2">
        <div v-for="(track, i) in tracks" :key="i" class="track-block">
          <div class="track-header">
            <span class="track-num">{{ i + 1 }}</span>
            <input v-model="track.title" class="field-input flex-1" :placeholder="$t('media.releaseForm.trackTitle', { n: i + 1 })" />
            <input v-model="track.duration" class="field-input track-dur" placeholder="3:42" />
            <button type="button" class="track-toggle-btn" :class="{ 'track-toggle-btn--has': track.showMeta }"
              @click="track.showMeta = !track.showMeta">{{ $t('media.releaseForm.tabMeta') }}</button>
            <button type="button" class="track-toggle-btn" :class="{ 'track-toggle-btn--has': track.showLyrics }"
              @click="track.showLyrics = !track.showLyrics">{{ $t('media.releaseForm.tabLyrics') }}</button>
            <button type="button" class="track-toggle-btn" :class="{ 'track-toggle-btn--has': track.showLinks }"
              @click="track.showLinks = !track.showLinks">{{ $t('media.releaseForm.tabLinks') }}</button>
            <button type="button" class="track-remove" @click="removeTrack(i)">✕</button>
          </div>

          <div v-if="track.showMeta" class="track-panel">
            <div class="grid grid-cols-3 gap-2 mb-2">
              <div>
                <label class="field-label">{{ $t('media.releaseForm.bpm') }}</label>
                <input v-model="track.bpm" type="number" min="1" max="400" class="field-input" placeholder="120" />
              </div>
              <div>
                <label class="field-label">{{ $t('media.releaseForm.key') }}</label>
                <select v-model="track.musical_key" class="field-input">
                  <option value="">—</option>
                  <option v-for="k in MUSICAL_KEYS" :key="k" :value="k">{{ k }}</option>
                </select>
              </div>
              <div>
                <label class="field-label">{{ $t('media.releaseForm.isrc') }}</label>
                <input v-model="track.isrc" class="field-input" :placeholder="$t('media.releaseForm.isrcPlaceholder')" />
              </div>
            </div>
            <div class="mb-2">
              <label class="field-label">{{ $t('media.releaseForm.moodTags') }}</label>
              <input v-model="track.mood_tags" class="field-input" :placeholder="$t('media.releaseForm.moodPlaceholder')" />
            </div>
            <div class="mb-2">
              <label class="field-label">{{ $t('media.releaseForm.sync') }}</label>
              <input v-model="track.sync_placements" class="field-input" :placeholder="$t('media.releaseForm.syncPlaceholder')" />
            </div>
            <div class="flex gap-4">
              <label class="toggle-row toggle-row--small">
                <input type="checkbox" v-model="track.explicit" class="toggle-check" />
                <span class="toggle-track"><span class="toggle-thumb" /></span>
                <span class="toggle-label">{{ $t('media.releaseForm.explicit') }}</span>
              </label>
              <label class="toggle-row toggle-row--small">
                <input type="checkbox" v-model="track.stems_available" class="toggle-check" />
                <span class="toggle-track"><span class="toggle-thumb" /></span>
                <span class="toggle-label">{{ $t('media.releaseForm.stems') }}</span>
              </label>
            </div>
          </div>

          <div v-if="track.showLyrics" class="track-panel">
            <label class="field-label" style="margin-bottom:0.25rem;">{{ $t('media.releaseForm.lyrics') }}</label>
            <textarea v-model="track.lyrics" class="lyrics-textarea" :placeholder="$t('media.releaseForm.lyricsPlaceholder')" rows="8" />
          </div>

          <div v-if="track.showLinks" class="track-panel track-links-panel">
            <div class="track-links-hint">{{ $t('media.releaseForm.trackLinks') }}</div>
            <div v-for="p in PLATFORMS" :key="p.key" class="platform-row platform-row--compact">
              <span class="platform-dot" :style="`background:${p.color};`" />
              <span class="platform-name">{{ p.label }}</span>
              <input v-model="track.links[p.key]" class="field-input flex-1" :placeholder="$t('media.releaseForm.urlPlaceholder', { platform: p.label })" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
      <button type="submit" :disabled="loading || !canSave" class="btn-primary">
        {{ loading ? $t('common.actions.saving') : (initial ? $t('media.releaseForm.update') : $t('media.releaseForm.create')) }}
      </button>
    </div>

  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.trans-group { display: flex; flex-direction: column; gap: 0.375rem; }
.trans-row   { display: flex; align-items: center; gap: 0.5rem; }
.trans-row--top { align-items: flex-start; }
.lang-badge {
  font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.06em;
  padding: 0.2rem 0.45rem; border-radius: 0.25rem; flex-shrink: 0;
  background: var(--c-1e3a5f); color: var(--c-60a5fa); width: 2rem; text-align: center;
}
.lang-badge--pl { background: var(--c-3f1010); color: var(--c-f87171); }

.section-title {
  font-size: var(--fs-2xs); font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--c-64748b); margin-bottom: 0.625rem;
}
.platform-row  { display: flex; align-items: center; gap: 0.625rem; }
.platform-row--compact { gap: 0.5rem; }
.platform-dot  { width: 0.5rem; height: 0.5rem; border-radius: 9999px; flex-shrink: 0; }
.platform-name { font-size: var(--fs-xs); font-weight: 500; color: var(--c-94a3b8); width: 7rem; flex-shrink: 0; }

.upcoming-block { display: flex; flex-direction: column; justify-content: flex-end; }

/* ── Toggle ──────────────────────────────────────────────────── */
.toggle-row { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none; }
.toggle-row--small { gap: 0.375rem; }
.toggle-check { display: none; }
.toggle-track {
  width: 2rem; height: 1rem; border-radius: 9999px; background: var(--c-222222);
  position: relative; flex-shrink: 0; transition: background 150ms;
  border: 1px solid var(--c-2a2a2a);
}
.toggle-check:checked + .toggle-track { background: var(--c-333333); border-color: var(--c-333333); }
.toggle-thumb {
  position: absolute; top: 1px; left: 1px; width: 0.625rem; height: 0.625rem;
  border-radius: 9999px; background: var(--c-475569); transition: transform 150ms, background 150ms;
}
.toggle-check:checked + .toggle-track .toggle-thumb { transform: translateX(1rem); background: var(--c-ffffff); }
.toggle-label { font-size: var(--fs-sm); color: var(--c-94a3b8); }

/* ── Cover drop ──────────────────────────────────────────────── */
.cover-drop {
  border: 2px dashed var(--c-2a2a2a); border-radius: 0.5rem;
  background: var(--c-141414); cursor: pointer; overflow: hidden;
  transition: border-color 150ms, background 150ms;
  min-height: 120px; display: flex; align-items: center; justify-content: center;
}
.cover-drop:hover { border-color: var(--c-888888); background: var(--c-141414); }
.cover-drop.has-image { border-style: solid; border-color: var(--c-2a2a2a); min-height: 0; }
.cover-img { display: block; width: 100%; max-height: 240px; object-fit: contain; background: var(--c-0d0d0d); }
.cover-placeholder { display: flex; flex-direction: column; align-items: center; gap: 0.375rem; padding: 1.5rem; }
.cover-icon { width: 2rem; height: 2rem; color: var(--c-334155); }
.cover-hint { font-size: var(--fs-sm); color: var(--c-475569); }

/* ── Tracks ──────────────────────────────────────────────────── */
.track-block { border: 1px solid var(--c-2a2a2a); border-radius: 0.5rem; overflow: hidden; }
.track-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.625rem; background: var(--c-141414); }
.track-num { font-size: var(--fs-xs); font-weight: 600; color: var(--c-475569); width: 1.25rem; text-align: center; flex-shrink: 0; }
.track-dur { max-width: 5rem; }
.track-toggle-btn {
  padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: var(--fs-2xs); font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid var(--c-2a2a2a); color: var(--c-475569);
  transition: background 120ms, border-color 120ms, color 120ms; flex-shrink: 0;
}
.track-toggle-btn:hover { background: var(--c-16163a); border-color: var(--c-333333); color: var(--c-94a3b8); }
.track-toggle-btn--has  { border-color: var(--c-333333); color: var(--c-c0c0c0); }
.track-remove {
  padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: var(--fs-xs);
  cursor: pointer; background: transparent; border: 1px solid var(--c-2d1212); color: var(--c-f87171);
  transition: background 120ms; flex-shrink: 0;
}
.track-remove:hover { background: var(--c-2d1010); }

.track-panel { padding: 0.625rem 0.875rem; border-top: 1px solid var(--c-222222); background: var(--c-111111); }
.track-links-panel { display: flex; flex-direction: column; gap: 0.375rem; }
.track-links-hint { font-size: var(--fs-2xs); color: var(--c-475569); margin-bottom: 0.375rem; }

.lyrics-textarea {
  width: 100%; background: var(--c-141414); border: 1px solid var(--c-2a2a2a); border-radius: 0.375rem;
  color: var(--c-e2e8f0); font-size: var(--fs-sm); padding: 0.5rem 0.625rem; outline: none;
  font-family: 'Courier New', monospace; line-height: 1.6; resize: vertical;
  transition: border-color 150ms, box-shadow 150ms;
}
.lyrics-textarea:focus {
  border-color: var(--c-888888);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18); /* token-lint-ignore: indigo focus glow, same on both themes */
}
</style>
