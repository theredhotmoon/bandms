<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useSetlist } from '@/composables/useSetlists'
import { useSongs } from '@/composables/useSongs'
import { useConcerts } from '@/composables/useConcerts'
import type { SetlistItem, SetlistTransition } from '@/types/setlist'
import type { Song } from '@/types/song'

const props = defineProps<{ setlistId: number }>()

const openId = computed(() => props.setlistId)
const { query, update, addItem, updateItem, removeItem, reorder } = useSetlist(openId)
const { list: songsQuery, create: createSong } = useSongs()
const { query: concertsQuery } = useConcerts()

// ── Setlist meta edit ─────────────────────────────────────────────────────────

type NoteTab = 'foh' | 'lighting'
const noteTab = ref<NoteTab>('foh')

const metaForm = ref({ name: '', concert_id: null as number | null, foh_notes: '', lighting_notes: '' })
const savingMeta = ref(false)
const savedMeta  = ref(false)

watch(() => query.data.value, (s) => {
  if (!s) return
  metaForm.value = {
    name:           s.name,
    concert_id:     s.concert_id,
    foh_notes:      s.foh_notes,
    lighting_notes: s.lighting_notes,
  }
}, { immediate: true })

async function saveMeta() {
  savingMeta.value = true
  try {
    await update.mutateAsync({
      name:           metaForm.value.name,
      concert_id:     metaForm.value.concert_id,
      foh_notes:      metaForm.value.foh_notes,
      lighting_notes: metaForm.value.lighting_notes,
    })
    savedMeta.value = true
    setTimeout(() => { savedMeta.value = false }, 2000)
    toast.success('Setlist saved')
  } catch {
    toast.error('Failed to save')
  } finally {
    savingMeta.value = false
  }
}

// Concert info derived from selection
const selectedConcert = computed(() => {
  if (!metaForm.value.concert_id) return null
  return concertsQuery.data.value?.find(c => c.id === metaForm.value.concert_id) ?? null
})

function concertLabel(c: { id: number; date: string; venue?: { name: string } | null }): string {
  const venue = c.venue?.name ?? 'Unknown venue'
  return `${formatDate(c.date)} — ${venue}`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${day} ${months[parseInt(m, 10) - 1]} ${y}`
}

// ── Song list ─────────────────────────────────────────────────────────────────

const expandedItemId = ref<number | null>(null)

function toggleExpand(id: number) {
  expandedItemId.value = expandedItemId.value === id ? null : id
}

function effectiveDuration(item: SetlistItem): number | null {
  return item.override_duration_sec ?? item.song?.duration_sec ?? null
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function totalDurationLabel(items: SetlistItem[]): string | null {
  const total = items.reduce((acc, it) => acc + (effectiveDuration(it) ?? 0), 0)
  if (!total) return null
  return `${Math.floor(total / 60)} min`
}

// Reorder
async function moveItem(items: SetlistItem[], fromIdx: number, dir: -1 | 1) {
  const toIdx = fromIdx + dir
  if (toIdx < 0 || toIdx >= items.length) return
  const newOrder = [...items.map((i) => i.id)]
  ;[newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]]
  try {
    await reorder.mutateAsync(newOrder)
  } catch {
    toast.error('Reorder failed')
  }
}

// Update item field
async function patchItem(itemId: number, patch: Partial<{
  is_encore: boolean
  transition: SetlistTransition | null
  lighting_cue: string
  sound_note: string
  override_duration_sec: number | null
}>) {
  try {
    await updateItem.mutateAsync({ itemId, payload: patch })
  } catch {
    toast.error('Failed to update')
  }
}

// Remove item
const confirmRemoveId = ref<number | null>(null)

async function doRemoveItem() {
  if (!confirmRemoveId.value) return
  try {
    await removeItem.mutateAsync(confirmRemoveId.value)
    if (expandedItemId.value === confirmRemoveId.value) expandedItemId.value = null
    confirmRemoveId.value = null
  } catch {
    toast.error('Failed to remove')
  }
}

// ── Add song ──────────────────────────────────────────────────────────────────

const showAddSong    = ref(false)
const addSongFilter  = ref('')
const addSongNewTitle = ref('')
const addingNew       = ref(false)

const filteredSongs = computed(() => {
  const songs = songsQuery.data.value ?? []
  const q = addSongFilter.value.toLowerCase()
  if (!q) return songs
  return songs.filter((s) => s.title.toLowerCase().includes(q))
})

async function addExistingSong(song: Song) {
  try {
    await addItem.mutateAsync({ song_id: song.id, is_encore: false })
    showAddSong.value = false
    addSongFilter.value = ''
    toast.success(`Added "${song.title}"`)
  } catch {
    toast.error('Failed to add song')
  }
}

async function addNewSong() {
  const title = addSongNewTitle.value.trim()
  if (!title) return
  addingNew.value = true
  try {
    const song = await createSong.mutateAsync({ title })
    await addItem.mutateAsync({ song_id: song.id, is_encore: false })
    addSongNewTitle.value = ''
    showAddSong.value = false
    toast.success(`Created & added "${song.title}"`)
  } catch {
    toast.error('Failed to create song')
  } finally {
    addingNew.value = false
  }
}

const TRANSITIONS: { value: SetlistTransition | ''; label: string }[] = [
  { value: '',       label: '— none —' },
  { value: 'pause',  label: 'Pause' },
  { value: 'segue',  label: 'Segue (no gap)' },
  { value: 'talk',   label: 'Talk to audience' },
  { value: 'end',    label: 'End of set' },
]
</script>

<template>
  <div class="editor-root">

    <div v-if="query.isPending.value" class="state-msg">Loading…</div>
    <div v-else-if="query.isError.value" class="state-msg state-err">Failed to load setlist.</div>

    <template v-else-if="query.data.value">

      <!-- Top bar -->
      <div class="topbar">
        <span class="topbar-name">{{ query.data.value.name }}</span>
        <div class="topbar-right">
          <span v-if="query.data.value.total_duration_sec" class="total-dur">
            {{ totalDurationLabel(query.data.value.items) }}
          </span>
          <button
            type="button"
            class="btn-save"
            :class="{ 'btn-save--ok': savedMeta }"
            :disabled="savingMeta"
            @click="saveMeta"
          >{{ savedMeta ? 'Saved ✓' : savingMeta ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>

      <!-- Meta fields -->
      <div class="meta-grid">
        <div class="field-group col-span-2">
          <label class="field-label">Setlist name</label>
          <input v-model="metaForm.name" class="field-input" placeholder="e.g. Summer festival 2026" />
        </div>

        <!-- Concert picker -->
        <div class="field-group col-span-2">
          <label class="field-label">Assign to gig <span class="opt">(optional — assigns date & venue)</span></label>
          <select
            :value="metaForm.concert_id ?? ''"
            class="field-input"
            @change="metaForm.concert_id = ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null"
          >
            <option value="">— Preset (no gig assigned) —</option>
            <option
              v-for="c in concertsQuery.data.value ?? []"
              :key="c.id"
              :value="c.id"
            >{{ concertLabel(c) }}</option>
          </select>

          <!-- Resolved info when concert selected -->
          <div v-if="selectedConcert" class="concert-info">
            <span class="concert-info-chip">📅 {{ formatDate(selectedConcert.date) }}</span>
            <span class="concert-info-chip">📍 {{ selectedConcert.venue?.name ?? 'Unknown venue' }}</span>
          </div>
          <div v-else class="preset-note">
            This setlist is saved as a preset — assign it to a gig to set date &amp; venue.
          </div>
        </div>
      </div>

      <!-- Song list -->
      <div class="song-list-header">
        <span class="section-title">Running order</span>
        <span v-if="query.data.value.items.length" class="song-count">
          {{ query.data.value.items.length }} songs
        </span>
      </div>

      <div class="song-list">
        <div v-if="!query.data.value.items.length" class="empty-songs">
          No songs yet — add one below.
        </div>

        <div
          v-for="(item, idx) in query.data.value.items"
          :key="item.id"
          class="song-card"
          :class="{ 'song-card--encore': item.is_encore }"
        >
          <div class="song-row">
            <span class="song-pos">{{ item.position }}</span>

            <div class="song-info" @click="toggleExpand(item.id)">
              <span class="song-title">{{ item.song?.title ?? '…' }}</span>
              <div class="song-badges">
                <span v-if="item.is_encore" class="badge-encore">ENCORE</span>
                <span v-if="item.transition" class="badge-transition">{{ item.transition }}</span>
                <span v-if="item.lighting_cue" class="badge-cue" title="Has lighting cue">💡</span>
                <span v-if="item.sound_note" class="badge-cue" title="Has sound note">🎛️</span>
              </div>
            </div>

            <span class="song-dur">{{ formatDuration(effectiveDuration(item)) }}</span>

            <div class="song-actions">
              <button
                type="button"
                class="btn-icon"
                title="Move up"
                :disabled="idx === 0"
                @click="moveItem(query.data.value!.items, idx, -1)"
              >↑</button>
              <button
                type="button"
                class="btn-icon"
                title="Move down"
                :disabled="idx === query.data.value!.items.length - 1"
                @click="moveItem(query.data.value!.items, idx, 1)"
              >↓</button>
              <button
                type="button"
                class="btn-icon btn-expand"
                :class="{ active: expandedItemId === item.id }"
                title="Edit details"
                @click="toggleExpand(item.id)"
              >✎</button>
              <button
                type="button"
                class="btn-icon btn-remove"
                title="Remove"
                @click="confirmRemoveId = item.id"
              >✕</button>
            </div>
          </div>

          <!-- Expanded details -->
          <div v-if="expandedItemId === item.id" class="song-expanded">
            <div class="exp-grid">
              <div class="field-group">
                <label class="field-label">Encore</label>
                <button
                  type="button"
                  class="toggle"
                  :class="{ 'toggle--on': item.is_encore }"
                  @click="patchItem(item.id, { is_encore: !item.is_encore })"
                >
                  <span class="toggle-thumb" />
                </button>
              </div>

              <div class="field-group">
                <label class="field-label">Transition after song</label>
                <select
                  :value="item.transition ?? ''"
                  class="field-input"
                  @change="patchItem(item.id, { transition: ($event.target as HTMLSelectElement).value as SetlistTransition || null })"
                >
                  <option v-for="t in TRANSITIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>

              <div class="field-group col-span-2">
                <label class="field-label">Lighting cue <span class="opt">(optional)</span></label>
                <input
                  :value="item.lighting_cue"
                  class="field-input"
                  placeholder="e.g. Red wash, strobe on drop"
                  @blur="patchItem(item.id, { lighting_cue: ($event.target as HTMLInputElement).value })"
                />
              </div>

              <div class="field-group col-span-2">
                <label class="field-label">Sound note <span class="opt">(optional)</span></label>
                <input
                  :value="item.sound_note"
                  class="field-input"
                  placeholder="e.g. Add reverb, boost low-mids"
                  @blur="patchItem(item.id, { sound_note: ($event.target as HTMLInputElement).value })"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Override duration (sec) <span class="opt">(optional)</span></label>
                <input
                  :value="item.override_duration_sec ?? ''"
                  type="number"
                  min="1"
                  max="7200"
                  class="field-input"
                  placeholder="e.g. 245"
                  @blur="patchItem(item.id, { override_duration_sec: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null })"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add song panel -->
      <div class="add-section">
        <button type="button" class="btn-add-song" @click="showAddSong = !showAddSong">
          + Add song
        </button>

        <div v-if="showAddSong" class="add-panel">
          <input
            v-model="addSongFilter"
            class="field-input"
            placeholder="Search song library…"
            autofocus
          />
          <div class="add-song-list">
            <button
              v-for="s in filteredSongs"
              :key="s.id"
              type="button"
              class="add-song-row"
              @click="addExistingSong(s)"
            >
              <span>{{ s.title }}</span>
              <span class="add-song-dur">{{ formatDuration(s.duration_sec) }}</span>
            </button>
            <div v-if="!filteredSongs.length" class="add-song-empty">No matching songs in library.</div>
          </div>
          <div class="add-new-row">
            <input
              v-model="addSongNewTitle"
              class="field-input"
              placeholder="Or type new song title to create…"
              @keydown.enter="addNewSong"
            />
            <button
              type="button"
              class="btn-create-song"
              :disabled="!addSongNewTitle.trim() || addingNew"
              @click="addNewSong"
            >{{ addingNew ? '…' : 'Create & add' }}</button>
          </div>
        </div>
      </div>

      <!-- Notes tabs -->
      <div class="notes-section">
        <div class="notes-tabs">
          <button type="button" class="notes-tab" :class="{ active: noteTab === 'foh' }" @click="noteTab = 'foh'">🎛️ FOH notes</button>
          <button type="button" class="notes-tab" :class="{ active: noteTab === 'lighting' }" @click="noteTab = 'lighting'">💡 Lighting notes</button>
        </div>
        <textarea
          v-if="noteTab === 'foh'"
          v-model="metaForm.foh_notes"
          class="notes-textarea"
          rows="4"
          placeholder="Global FOH / PA notes for this show — mix preferences, effects, etc."
        />
        <textarea
          v-else
          v-model="metaForm.lighting_notes"
          class="notes-textarea"
          rows="4"
          placeholder="Global lighting notes — colour palette, effects, general mood, etc."
        />
      </div>

      <!-- Bottom save -->
      <div class="bottom-bar">
        <button
          type="button"
          class="btn-save"
          :class="{ 'btn-save--ok': savedMeta }"
          :disabled="savingMeta"
          @click="saveMeta"
        >{{ savedMeta ? 'Saved ✓' : savingMeta ? 'Saving…' : 'Save setlist' }}</button>
      </div>

    </template>

    <!-- Confirm remove item -->
    <div v-if="confirmRemoveId !== null" class="confirm-overlay" @click.self="confirmRemoveId = null">
      <div class="confirm-card">
        <div class="confirm-title">Remove song?</div>
        <p class="confirm-text">This removes the song from this setlist (not from the library).</p>
        <div class="confirm-actions">
          <button type="button" class="btn-ghost" @click="confirmRemoveId = null">Cancel</button>
          <button type="button" class="btn-danger" @click="doRemoveItem">Remove</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.editor-root {
  display: flex; flex-direction: column; gap: 0; height: 100%; overflow-y: auto; position: relative;
}
.state-msg {
  display: flex; align-items: center; justify-content: center;
  height: 100%; font-size: 0.85rem; color: #475569;
}
.state-err { color: #f87171; }

.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.625rem 1rem; border-bottom: 1px solid #0f0f28; background: #070718; flex-shrink: 0;
}
.topbar-name { font-size: 0.875rem; font-weight: 700; color: #e2e8f0; }
.topbar-right { display: flex; align-items: center; gap: 0.75rem; }
.total-dur { font-size: 0.72rem; color: #475569; }

.meta-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem;
  padding: 0.75rem 1rem; border-bottom: 1px solid #0f0f28; background: #070718; flex-shrink: 0;
}
.col-span-2 { grid-column: span 2; }
.field-group { display: flex; flex-direction: column; gap: 0.2rem; }
.field-label { font-size: 0.68rem; font-weight: 600; color: #7c8fa6; }
.opt { color: #334155; font-weight: 400; }
.field-input {
  display: block; width: 100%; padding: 0.4rem 0.6rem; border-radius: 0.4rem;
  border: 1px solid #1e2040; background: #070718; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
  box-sizing: border-box;
}
.field-input:focus { border-color: #5154e5; }
.field-input option { background: #0e0e26; }
select.field-input {
  appearance: none; -webkit-appearance: none; padding-right: 2rem; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a5568' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.6rem center;
}

.concert-info { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem; }
.concert-info-chip {
  font-size: 0.7rem; color: #a5b4fc; background: #1e1b4b;
  border: 1px solid #312e81; border-radius: 0.3rem; padding: 0.15rem 0.5rem;
}
.preset-note {
  font-size: 0.68rem; color: #334155; margin-top: 0.2rem; font-style: italic;
}

.song-list-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 1rem 0.25rem; flex-shrink: 0;
}
.section-title { font-size: 0.68rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
.song-count { font-size: 0.68rem; color: #334155; }

.song-list { display: flex; flex-direction: column; gap: 0.3rem; padding: 0 1rem; flex-shrink: 0; }
.empty-songs { font-size: 0.78rem; color: #334155; text-align: center; padding: 1.5rem 0; }

.song-card { background: #0a0a1e; border: 1px solid #1e2040; border-radius: 0.5rem; overflow: hidden; }
.song-card--encore { border-color: #312e81; }

.song-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.625rem; }
.song-pos { font-size: 0.65rem; color: #334155; width: 1.5rem; text-align: right; flex-shrink: 0; }
.song-info { flex: 1; min-width: 0; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; }
.song-title { font-size: 0.82rem; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-badges { display: flex; gap: 0.25rem; flex-shrink: 0; }
.badge-encore {
  font-size: 0.58rem; font-weight: 700; color: #818cf8;
  background: #1e1b4b; border-radius: 0.2rem; padding: 0.1rem 0.3rem;
}
.badge-transition {
  font-size: 0.58rem; color: #475569; background: #0e0e26;
  border: 1px solid #1e2040; border-radius: 0.2rem; padding: 0.1rem 0.3rem;
}
.badge-cue { font-size: 0.7rem; }
.song-dur { font-size: 0.68rem; color: #334155; width: 2.5rem; text-align: right; flex-shrink: 0; }
.song-actions { display: flex; gap: 0.15rem; flex-shrink: 0; }

.btn-icon {
  width: 1.5rem; height: 1.5rem; border-radius: 0.3rem; border: 1px solid #1e2040;
  background: transparent; color: #475569; cursor: pointer; font-size: 0.7rem;
  display: flex; align-items: center; justify-content: center; transition: all 100ms;
}
.btn-icon:hover:not(:disabled) { background: #0e0e26; color: #94a3b8; border-color: #334155; }
.btn-icon:disabled { opacity: 0.25; cursor: default; }
.btn-expand.active { background: #1e1b4b; color: #818cf8; border-color: #312e81; }
.btn-remove:hover:not(:disabled) { background: #450a0a; color: #f87171; border-color: #7f1d1d; }

.song-expanded {
  border-top: 1px solid #1e2040; padding: 0.75rem 0.875rem; background: #060614;
}
.exp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }

.toggle {
  position: relative; width: 2.5rem; height: 1.375rem; border-radius: 9999px;
  border: none; cursor: pointer; background: #1e293b; transition: background 200ms;
}
.toggle--on { background: #1e1b4b; }
.toggle-thumb {
  position: absolute; top: 0.1875rem; left: 0.1875rem;
  width: 1rem; height: 1rem; border-radius: 9999px;
  background: #475569; transition: transform 200ms, background 200ms;
}
.toggle--on .toggle-thumb { transform: translateX(1.125rem); background: #818cf8; }

.add-section { padding: 0.75rem 1rem; flex-shrink: 0; }
.btn-add-song {
  font-size: 0.75rem; font-weight: 600; color: #818cf8;
  background: transparent; border: 1px dashed #312e81; border-radius: 0.375rem;
  cursor: pointer; padding: 0.375rem 0.875rem; transition: background 100ms, border-color 100ms;
}
.btn-add-song:hover { background: #12103a; border-color: #4338ca; }

.add-panel {
  margin-top: 0.5rem; background: #0a0a1e; border: 1px solid #1e2040;
  border-radius: 0.5rem; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;
}
.add-song-list { max-height: 12rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.2rem; }
.add-song-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.35rem 0.5rem; border-radius: 0.3rem; background: #060614;
  border: 1px solid transparent; cursor: pointer; text-align: left; font-size: 0.8rem; color: #e2e8f0;
  transition: border-color 100ms;
}
.add-song-row:hover { border-color: #4338ca; }
.add-song-dur { font-size: 0.68rem; color: #334155; }
.add-song-empty { font-size: 0.75rem; color: #334155; text-align: center; padding: 0.75rem 0; }
.add-new-row { display: flex; gap: 0.5rem; }
.btn-create-song {
  padding: 0.4rem 0.75rem; border-radius: 0.4rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: #1e1b4b; border: 1px solid #312e81; color: #818cf8;
  white-space: nowrap; transition: background 100ms;
}
.btn-create-song:hover:not(:disabled) { background: #252370; }
.btn-create-song:disabled { opacity: 0.4; cursor: default; }

.notes-section { border-top: 1px solid #0f0f28; padding: 0.75rem 1rem 0; flex-shrink: 0; }
.notes-tabs { display: flex; border-bottom: 1px solid #0f0f28; margin-bottom: 0.5rem; }
.notes-tab {
  padding: 0.35rem 0.75rem; font-size: 0.72rem; font-weight: 500; color: #475569;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: color 120ms, border-color 120ms; margin-bottom: -1px;
}
.notes-tab:hover { color: #64748b; }
.notes-tab.active { color: #a5b4fc; border-bottom-color: #6366f1; }
.notes-textarea {
  width: 100%; padding: 0.5rem 0.625rem; border-radius: 0.4rem;
  border: 1px solid #1e2040; background: #0e0e26; color: #e2e8f0;
  font-size: 0.82rem; font-family: inherit; outline: none; resize: vertical;
  transition: border-color 150ms; box-sizing: border-box;
}
.notes-textarea:focus { border-color: #5154e5; }

.bottom-bar {
  border-top: 1px solid #0f0f28; padding: 0.625rem 1rem;
  display: flex; justify-content: flex-end; background: #070718; flex-shrink: 0;
}
.btn-save {
  padding: 0.4rem 1.1rem; border-radius: 0.45rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
  transition: background 150ms; min-width: 6rem;
}
.btn-save:hover:not(:disabled) { background: #4f46e5; }
.btn-save:disabled { opacity: 0.55; cursor: default; }
.btn-save--ok { background: #166534 !important; }

.confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 50;
  display: flex; align-items: center; justify-content: center;
}
.confirm-card {
  background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.75rem;
  padding: 1.25rem; width: 22rem; display: flex; flex-direction: column; gap: 0.75rem;
}
.confirm-title { font-size: 0.9rem; font-weight: 700; color: #e2e8f0; }
.confirm-text  { font-size: 0.8rem; color: #94a3b8; line-height: 1.5; }
.confirm-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.btn-ghost {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #64748b;
}
.btn-ghost:hover { background: #0a0a1e; }
.btn-danger {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5;
}
.btn-danger:hover { background: #450a0a; }
</style>
