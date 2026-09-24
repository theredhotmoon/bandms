<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { formatShortDate } from '@/utils/formatDate'
import { useI18n } from 'vue-i18n'
import { useSetlistFmSearch, useSetlists } from '@/composables/useSetlists'
import type { SetlistFmArtist, SetlistFmSetlist } from '@/types/setlist'
import { reportSaveError } from '@/utils/formErrors'

const { t, locale } = useI18n()
const emit = defineEmits<{ close: []; imported: [setlistId: number] }>()

type Step = 'search' | 'setlists' | 'confirm'

const step         = ref<Step>('search')
const artistQuery  = ref('')
const artists      = ref<SetlistFmArtist[]>([])
const selectedArtist = ref<SetlistFmArtist | null>(null)
const setlists     = ref<SetlistFmSetlist[]>([])
const selectedSet  = ref<SetlistFmSetlist | null>(null)
const importName   = ref('')
const searching    = ref(false)
const loadingSets  = ref(false)
const importing    = ref(false)

const { searchArtist, fetchArtistSetlists } = useSetlistFmSearch()
const { importFm } = useSetlists()

async function doSearchArtist() {
  if (!artistQuery.value.trim()) return
  searching.value = true
  try {
    artists.value = await searchArtist.mutateAsync(artistQuery.value.trim())
    step.value = 'search'
  } catch (e) {
    reportSaveError(e, t('setlists.setlistFm.searchFailed'))
  } finally {
    searching.value = false
  }
}

async function pickArtist(artist: SetlistFmArtist) {
  selectedArtist.value = artist
  // Clear before the await. The step switches immediately, so a stale array
  // would be counted under the new artist's name — "Artist – 12 setlists"
  // above "Loading setlists…", or the previous artist's rows if the fetch
  // fails. The old static "– setlists" heading could not be wrong.
  setlists.value = []
  loadingSets.value = true
  step.value = 'setlists'
  try {
    const res = await fetchArtistSetlists.mutateAsync({ mbid: artist.mbid })
    setlists.value = res.data
  } catch (e) {
    reportSaveError(e, t('setlists.setlistFm.loadFailed'))
  } finally {
    loadingSets.value = false
  }
}

function pickSetlist(s: SetlistFmSetlist) {
  selectedSet.value = s
  importName.value = selectedArtist.value?.name
    ? `${selectedArtist.value.name} – ${s.event_date ?? ''}`.trim().replace(/–\s*$/, '').trim()
    : (s.event_date ?? t('setlists.setlistFm.imported'))
  step.value = 'confirm'
}

async function doImport() {
  if (!selectedSet.value || !importName.value.trim()) return
  importing.value = true
  try {
    const result = await importFm.mutateAsync({
      setlistfm_id: selectedSet.value.id,
      name:         importName.value.trim(),
      event_date:   selectedSet.value.event_date ? parseDate(selectedSet.value.event_date) : null,
      songs:        selectedSet.value.songs.map(s => ({ title: s.title, is_encore: s.is_encore })),
    })
    toast.success(t('setlists.setlistFm.importedNamed', { name: result.name }))
    emit('imported', result.id)
  } catch (e) {
    reportSaveError(e, t('setlists.setlistFm.importFailed'))
  } finally {
    importing.value = false
  }
}

function parseDate(d: string): string {
  // setlist.fm format: "DD-MM-YYYY"
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return d
}

const formatDate = (d: string | null) => (d ? formatShortDate(parseDate(d), locale.value) || d : '—')
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card">

      <div class="modal-header">
        <span class="modal-title">{{ $t('setlists.setlistFm.title') }}</span>
        <button type="button" class="btn-close" @click="emit('close')">✕</button>
      </div>

      <!-- Step: search artist -->
      <template v-if="step === 'search'">
        <div class="modal-body">
          <div class="search-row">
            <input
              v-model="artistQuery"
              class="field-input"
              :placeholder="$t('setlists.setlistFm.artistPlaceholder')"
              @keydown.enter="doSearchArtist"
              autofocus
            />
            <button type="button" class="btn-primary" :disabled="!artistQuery.trim() || searching" @click="doSearchArtist">
              {{ searching ? $t('setlists.setlistFm.searching') : $t('setlists.setlistFm.search') }}
            </button>
          </div>
          <div v-if="artists.length" class="results-list">
            <button
              v-for="a in artists"
              :key="a.mbid"
              type="button"
              class="result-row"
              @click="pickArtist(a)"
            >
              <span class="result-name">{{ a.name }}</span>
              <span class="result-arrow">›</span>
            </button>
          </div>
          <div v-else-if="!searching && artistQuery" class="empty-note">{{ $t('setlists.setlistFm.noResults') }}</div>
        </div>
      </template>

      <!-- Step: pick setlist -->
      <template v-else-if="step === 'setlists'">
        <div class="modal-body">
          <button type="button" class="btn-back" @click="step = 'search'">{{ $t('setlists.setlistFm.back') }}</button>
          <div class="section-title">{{ selectedArtist?.name }} – {{ $t('setlists.setlistFm.setlistCount', setlists.length, { named: { n: setlists.length } }) }}</div>
          <div v-if="loadingSets" class="loading-note">{{ $t('setlists.setlistFm.loading') }}</div>
          <div v-else-if="!setlists.length" class="empty-note">{{ $t('setlists.setlistFm.noSetlists') }}</div>
          <div v-else class="results-list">
            <button
              v-for="s in setlists"
              :key="s.id"
              type="button"
              class="result-row"
              @click="pickSetlist(s)"
            >
              <div class="setlist-row-info">
                <span class="result-name">{{ formatDate(s.event_date) }}</span>
                <span class="result-venue">{{ s.venue }}</span>
              </div>
              <span class="result-count">{{ $t('setlists.setlistFm.songCount', s.song_count, { named: { n: s.song_count } }) }}</span>
            </button>
          </div>
        </div>
      </template>

      <!-- Step: confirm -->
      <template v-else>
        <div class="modal-body">
          <button type="button" class="btn-back" @click="step = 'setlists'">{{ $t('setlists.setlistFm.back') }}</button>
          <div class="confirm-block">
            <div class="field-group">
              <label class="field-label">{{ $t('setlists.setlistFm.name') }}</label>
              <input v-model="importName" class="field-input" :placeholder="$t('setlists.setlistFm.namePlaceholder')" />
            </div>
            <div class="songs-preview">
              <div class="songs-preview-title">{{ $t('setlists.setlistFm.toImport', selectedSet?.songs.length ?? 0, { named: { n: selectedSet?.songs.length ?? 0 } }) }}</div>
              <div v-for="(s, i) in selectedSet?.songs" :key="i" class="preview-song">
                <span class="preview-pos">{{ i + 1 }}</span>
                <span class="preview-title">{{ s.title }}</span>
                <span v-if="s.is_encore" class="preview-encore">{{ $t('setlists.setlistFm.encoreBadge') }}</span>
              </div>
            </div>
            <button
              type="button"
              class="btn-import"
              :disabled="!importName.trim() || importing"
              @click="doImport"
            >
              {{ importing ? $t('setlists.setlistFm.importing') : $t('setlists.setlistFm.import') }}
            </button>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.modal-card {
  background: #141414; border: 1px solid #2a2a2a; border-radius: 0.75rem;
  width: 100%; max-width: 30rem; max-height: 85vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.875rem 1rem; border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
}
.modal-title { font-size: 0.875rem; font-weight: 700; color: #e2e8f0; }
.btn-close {
  background: none; border: none; cursor: pointer; color: #475569;
  font-size: 0.8rem; padding: 0.2rem 0.4rem;
}
.btn-close:hover { color: #94a3b8; }

.modal-body { padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }

.search-row { display: flex; gap: 0.5rem; }
.field-input {
  flex: 1; padding: 0.4rem 0.6rem; border-radius: 0.4rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit;
}
.field-input:focus { border-color: #888888; }

.field-group { display: flex; flex-direction: column; gap: 0.2rem; }
.field-label { font-size: 0.68rem; font-weight: 600; color: #7c8fa6; }

.btn-primary {
  padding: 0.4rem 0.9rem; border-radius: 0.4rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111; white-space: nowrap;
  transition: background 100ms;
}
.btn-primary:hover:not(:disabled) { background: #333333; }
.btn-primary:disabled { opacity: 0.4; cursor: default; }

.results-list { display: flex; flex-direction: column; gap: 0.25rem; }
.result-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0.625rem; border-radius: 0.4rem;
  background: #111111; border: 1px solid #2a2a2a;
  cursor: pointer; text-align: left; transition: border-color 100ms;
  width: 100%;
}
.result-row:hover { border-color: #888888; }
.result-name { font-size: 0.8rem; font-weight: 600; color: #e2e8f0; }
.result-venue { font-size: 0.7rem; color: #475569; }
.result-count { font-size: 0.7rem; color: #4a5568; white-space: nowrap; }
.result-arrow { color: #888888; font-size: 1rem; }
.setlist-row-info { display: flex; flex-direction: column; gap: 0.1rem; }

.section-title { font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .06em; }

.btn-back {
  background: none; border: none; cursor: pointer; color: #888888;
  font-size: 0.75rem; font-weight: 600; padding: 0; align-self: flex-start;
}
.btn-back:hover { color: #c0c0c0; }

.empty-note, .loading-note { font-size: 0.78rem; color: #334155; text-align: center; padding: 1rem 0; }

.confirm-block { display: flex; flex-direction: column; gap: 1rem; }
.songs-preview {
  background: #111111; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  padding: 0.625rem 0.75rem; max-height: 16rem; overflow-y: auto;
  display: flex; flex-direction: column; gap: 0.25rem;
}
.songs-preview-title { font-size: 0.68rem; font-weight: 600; color: #475569; margin-bottom: 0.25rem; }
.preview-song { display: flex; align-items: center; gap: 0.5rem; }
.preview-pos { font-size: 0.65rem; color: #334155; width: 1.2rem; text-align: right; flex-shrink: 0; }
.preview-title { font-size: 0.78rem; color: #cbd5e1; flex: 1; }
.preview-encore {
  font-size: 0.58rem; font-weight: 700; color: #c0c0c0;
  background: #2a2a2a; border-radius: 0.25rem; padding: 0.1rem 0.3rem;
}

.btn-import {
  padding: 0.5rem 1.25rem; border-radius: 0.45rem; font-size: 0.82rem; font-weight: 700;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111;
  align-self: flex-end; transition: background 100ms;
}
.btn-import:hover:not(:disabled) { background: #333333; }
.btn-import:disabled { opacity: 0.4; cursor: default; }
</style>
