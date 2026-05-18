<script setup lang="ts">
import { ref, reactive } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SetlistEditor from '@/components/setlist/SetlistEditor.vue'
import SetlistFmImportModal from '@/components/setlist/SetlistFmImportModal.vue'
import { useSetlists } from '@/composables/useSetlists'
import { useSongs } from '@/composables/useSongs'

type MainTab = 'setlists' | 'library'
const mainTab = ref<MainTab>('setlists')

// ── Setlist list ──────────────────────────────────────────────────────────────

const { list, create, remove } = useSetlists()
const openId          = ref<number | null>(null)
const showImportModal = ref(false)
const showNewForm     = ref(false)
const newName         = ref('')
const creating        = ref(false)
const confirmDeleteId = ref<number | null>(null)

async function createSetlist() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    const s = await create.mutateAsync({ name: newName.value.trim() })
    openId.value     = s.id
    newName.value    = ''
    showNewForm.value = false
    toast.success('Setlist created')
  } catch {
    toast.error('Failed to create setlist')
  } finally {
    creating.value = false
  }
}

async function confirmDelete() {
  if (!confirmDeleteId.value) return
  try {
    await remove.mutateAsync(confirmDeleteId.value)
    if (openId.value === confirmDeleteId.value) openId.value = null
    confirmDeleteId.value = null
    toast.success('Setlist deleted')
  } catch {
    toast.error('Failed to delete')
  }
}

function formatDate(d: string | null): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${day} ${months[parseInt(m, 10) - 1]} ${y}`
}

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  return `${Math.floor(sec / 60)} min`
}

function handleImported(id: number) {
  openId.value = id
  showImportModal.value = false
}

// ── Song library ──────────────────────────────────────────────────────────────

const { list: songList, create: songCreate, update: songUpdate, remove: songRemove } = useSongs()

const showSongForm          = ref(false)
const editSongId            = ref<number | null>(null)
const songForm              = reactive({ title: '', duration_sec: '', bpm: '', key: '', notes: '' })
const savingSong            = ref(false)
const confirmSongDeleteId   = ref<number | null>(null)

function openNewSong() {
  editSongId.value = null
  songForm.title = ''
  songForm.duration_sec = ''
  songForm.bpm = ''
  songForm.key = ''
  songForm.notes = ''
  showSongForm.value = true
}

function openEditSong(song: { id: number; title: string; duration_sec: number | null; bpm: number | null; key: string | null; notes: string }) {
  editSongId.value = song.id
  songForm.title        = song.title
  songForm.duration_sec = song.duration_sec != null ? String(song.duration_sec) : ''
  songForm.bpm          = song.bpm != null ? String(song.bpm) : ''
  songForm.key          = song.key ?? ''
  songForm.notes        = song.notes
  showSongForm.value = true
}

async function submitSong() {
  if (!songForm.title.trim()) return
  savingSong.value = true
  const payload = {
    title:        songForm.title.trim(),
    duration_sec: songForm.duration_sec ? Number(songForm.duration_sec) : null,
    bpm:          songForm.bpm ? Number(songForm.bpm) : null,
    key:          songForm.key || null,
    notes:        songForm.notes || undefined,
  }
  try {
    if (editSongId.value) {
      await songUpdate.mutateAsync({ id: editSongId.value, payload })
      toast.success('Song updated')
    } else {
      await songCreate.mutateAsync(payload)
      toast.success('Song created')
    }
    showSongForm.value = false
  } catch {
    toast.error('Failed to save song')
  } finally {
    savingSong.value = false
  }
}

async function confirmDeleteSong() {
  if (!confirmSongDeleteId.value) return
  try {
    await songRemove.mutateAsync(confirmSongDeleteId.value)
    confirmSongDeleteId.value = null
    toast.success('Song deleted')
  } catch {
    toast.error('Failed to delete')
  }
}

function formatDur(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <AdminLayout>
    <div class="setlists-root">

      <!-- Main tabs -->
      <div class="main-tabs">
        <button class="main-tab" :class="{ active: mainTab === 'setlists' }" @click="mainTab = 'setlists'">
          🎵 Setlists
        </button>
        <button class="main-tab" :class="{ active: mainTab === 'library' }" @click="mainTab = 'library'">
          📋 Song library
        </button>
      </div>

      <!-- ── SETLISTS TAB ──────────────────────────────────────────────────── -->
      <div v-if="mainTab === 'setlists'" class="split-view">

        <!-- Left sidebar -->
        <aside class="sidebar">
          <div class="sidebar-header">
            <span class="sidebar-title">Setlists</span>
            <div class="sidebar-actions">
              <button type="button" class="btn-import-fm" @click="showImportModal = true">↓ setlist.fm</button>
              <button type="button" class="btn-new-icon" @click="showNewForm = !showNewForm">+</button>
            </div>
          </div>

          <div v-if="showNewForm" class="new-form">
            <input
              v-model="newName"
              class="new-input"
              placeholder="Setlist name…"
              autofocus
              @keydown.enter="createSetlist"
              @keydown.escape="showNewForm = false; newName = ''"
            />
            <button type="button" class="btn-create" :disabled="!newName.trim() || creating" @click="createSetlist">
              {{ creating ? '…' : 'Create' }}
            </button>
          </div>

          <div v-if="list.isPending.value" class="sidebar-state">Loading…</div>
          <div v-else-if="list.isError.value" class="sidebar-state sidebar-err">Error loading setlists</div>
          <div v-else-if="!list.data.value?.length" class="sidebar-state">No setlists yet.</div>
          <div v-else class="setlist-items">
            <div
              v-for="s in list.data.value"
              :key="s.id"
              class="setlist-item"
              :class="{ 'setlist-item--open': openId === s.id }"
              @click="openId = s.id"
            >
              <div class="setlist-item-info">
                <span class="setlist-name">{{ s.name }}</span>
                <div class="setlist-meta">
                  <!-- Show gig info if assigned, otherwise show preset badge -->
                  <template v-if="s.concert_id">
                    <span class="meta-gig">{{ formatDate(s.concert_date) }}</span>
                    <span class="meta-gig">{{ s.concert_venue }}</span>
                  </template>
                  <span v-else class="meta-preset">preset</span>
                  <span>{{ s.item_count }} songs</span>
                  <span v-if="s.total_duration_sec">{{ formatDuration(s.total_duration_sec) }}</span>
                </div>
              </div>
              <button type="button" class="del-btn" @click.stop="confirmDeleteId = s.id">✕</button>
            </div>
          </div>
        </aside>

        <!-- Right editor -->
        <div class="editor-pane">
          <div v-if="openId === null" class="empty-state">
            <div class="empty-icon">🎵</div>
            <div class="empty-title">No setlist selected</div>
            <p class="empty-hint">Pick a setlist from the sidebar, or create a new one.<br>Setlists are saved as presets and can be assigned to a gig.</p>
          </div>
          <SetlistEditor v-else :key="openId" :setlist-id="openId" />
        </div>

      </div>

      <!-- ── SONG LIBRARY TAB ─────────────────────────────────────────────── -->
      <div v-else class="library-view">
        <div class="library-header">
          <span class="lib-title">Song library</span>
          <button type="button" class="btn-new-song" @click="openNewSong">+ New song</button>
        </div>

        <div v-if="songList.isPending.value" class="lib-state">Loading…</div>
        <div v-else-if="songList.isError.value" class="lib-state lib-err">Failed to load songs.</div>
        <div v-else-if="!songList.data.value?.length" class="lib-state">
          No songs yet. Songs are added here or automatically when you add them to a setlist.
        </div>
        <table v-else class="song-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Duration</th>
              <th>BPM</th>
              <th>Key</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in songList.data.value" :key="s.id">
              <td class="td-title">{{ s.title }}</td>
              <td class="td-meta">{{ formatDur(s.duration_sec) }}</td>
              <td class="td-meta">{{ s.bpm ?? '—' }}</td>
              <td class="td-meta">{{ s.key ?? '—' }}</td>
              <td class="td-notes">{{ s.notes || '—' }}</td>
              <td class="td-actions">
                <button type="button" class="btn-edit" @click="openEditSong(s)">Edit</button>
                <button type="button" class="btn-del" @click="confirmSongDeleteId = s.id">Del</button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Song form modal -->
        <div v-if="showSongForm" class="song-modal-overlay" @click.self="showSongForm = false">
          <div class="song-modal">
            <div class="song-modal-header">
              <span>{{ editSongId ? 'Edit song' : 'New song' }}</span>
              <button type="button" class="btn-close" @click="showSongForm = false">✕</button>
            </div>
            <div class="song-modal-body">
              <div class="field-group">
                <label class="field-label">Title <span style="color:#f87171">*</span></label>
                <input v-model="songForm.title" class="field-input" placeholder="Song title" autofocus />
              </div>
              <div class="song-form-grid">
                <div class="field-group">
                  <label class="field-label">Duration (seconds)</label>
                  <input v-model="songForm.duration_sec" type="number" min="1" max="7200" class="field-input" placeholder="e.g. 245" />
                </div>
                <div class="field-group">
                  <label class="field-label">BPM</label>
                  <input v-model="songForm.bpm" type="number" min="20" max="400" class="field-input" placeholder="e.g. 128" />
                </div>
                <div class="field-group">
                  <label class="field-label">Key</label>
                  <input v-model="songForm.key" class="field-input" placeholder="e.g. A minor" />
                </div>
              </div>
              <div class="field-group">
                <label class="field-label">Notes <span class="opt">(optional)</span></label>
                <textarea v-model="songForm.notes" class="field-input" rows="2" style="resize:vertical" />
              </div>
              <div class="song-form-actions">
                <button type="button" class="btn-ghost" @click="showSongForm = false">Cancel</button>
                <button type="button" class="btn-save-song" :disabled="!songForm.title.trim() || savingSong" @click="submitSong">
                  {{ savingSong ? 'Saving…' : (editSongId ? 'Update' : 'Create') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Confirm delete song -->
        <div v-if="confirmSongDeleteId !== null" class="song-modal-overlay" @click.self="confirmSongDeleteId = null">
          <div class="song-modal song-modal--sm">
            <div class="song-modal-body">
              <p class="confirm-title">Delete this song?</p>
              <p class="confirm-text">This removes it from the library and all setlists it appears in.</p>
              <div class="song-form-actions">
                <button type="button" class="btn-ghost" @click="confirmSongDeleteId = null">Cancel</button>
                <button type="button" class="btn-danger" @click="confirmDeleteSong">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- setlist.fm import modal -->
      <SetlistFmImportModal
        v-if="showImportModal"
        @close="showImportModal = false"
        @imported="handleImported"
      />

      <!-- Confirm delete setlist -->
      <div v-if="confirmDeleteId !== null" class="confirm-overlay" @click.self="confirmDeleteId = null">
        <div class="confirm-card">
          <div class="confirm-title">Delete setlist?</div>
          <p class="confirm-text">This permanently deletes the setlist and all its items.</p>
          <div class="confirm-actions">
            <button type="button" class="btn-ghost" @click="confirmDeleteId = null">Cancel</button>
            <button type="button" class="btn-danger" @click="confirmDelete">Delete</button>
          </div>
        </div>
      </div>

    </div>
  </AdminLayout>
</template>

<style scoped>
.setlists-root {
  height: 100vh; display: flex; flex-direction: column; overflow: hidden;
}

.main-tabs {
  display: flex; border-bottom: 1px solid #0f0f28; background: #070718; flex-shrink: 0;
}
.main-tab {
  padding: 0.5rem 1rem; font-size: 0.78rem; font-weight: 500; color: #475569;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: color 120ms, border-color 120ms; margin-bottom: -1px;
}
.main-tab:hover { color: #64748b; }
.main-tab.active { color: #a5b4fc; border-bottom-color: #6366f1; }

.split-view { flex: 1; display: flex; overflow: hidden; }

.sidebar {
  width: 16rem; flex-shrink: 0; border-right: 1px solid #0f0f28; background: #060614;
  display: flex; flex-direction: column; overflow: hidden;
}
.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 0.875rem 0.5rem; border-bottom: 1px solid #0f0f28;
}
.sidebar-title { font-size: 0.7rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
.sidebar-actions { display: flex; gap: 0.35rem; align-items: center; }
.btn-import-fm {
  font-size: 0.65rem; font-weight: 600; color: #818cf8; padding: 0.2rem 0.45rem;
  background: #1e1b4b; border: 1px solid #312e81; border-radius: 0.3rem;
  cursor: pointer; transition: background 100ms;
}
.btn-import-fm:hover { background: #252370; }
.btn-new-icon {
  width: 1.5rem; height: 1.5rem; border-radius: 0.3rem;
  background: #1e1b4b; border: 1px solid #312e81; color: #818cf8;
  font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.btn-new-icon:hover { background: #252370; }

.new-form {
  display: flex; gap: 0.3rem; padding: 0.4rem 0.5rem; border-bottom: 1px solid #0f0f28;
}
.new-input {
  flex: 1; background: #0a0a1e; border: 1px solid #1e2040; border-radius: 0.3rem;
  color: #e2e8f0; font-size: 0.75rem; padding: 0.3rem 0.5rem; outline: none; font-family: inherit;
}
.new-input:focus { border-color: #4338ca; }
.btn-create {
  padding: 0.25rem 0.5rem; border-radius: 0.3rem; font-size: 0.72rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
}
.btn-create:disabled { opacity: 0.4; cursor: default; }

.sidebar-state { padding: 1rem; font-size: 0.78rem; color: #334155; text-align: center; line-height: 1.5; }
.sidebar-err { color: #f87171; }

.setlist-items { flex: 1; overflow-y: auto; padding: 0.4rem; }
.setlist-item {
  display: flex; align-items: flex-start; padding: 0.45rem 0.6rem; border-radius: 0.35rem;
  cursor: pointer; border: 1px solid transparent; margin-bottom: 0.25rem;
  transition: background 100ms, border-color 100ms;
}
.setlist-item:hover { background: #0d0d28; border-color: #1e2040; }
.setlist-item--open { background: #0e0e26; border-color: #312e81; }
.setlist-item-info { flex: 1; min-width: 0; }
.setlist-name { font-size: 0.78rem; font-weight: 600; color: #e2e8f0; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.setlist-meta { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.15rem; }
.setlist-meta span { font-size: 0.62rem; color: #334155; }
.meta-gig { color: #475569 !important; }
.meta-preset {
  font-size: 0.58rem !important; font-weight: 700; color: #6366f1 !important;
  background: #1e1b4b; border: 1px solid #312e81; border-radius: 0.2rem;
  padding: 0.05rem 0.3rem;
}
.del-btn {
  background: none; border: none; cursor: pointer; color: #1e2040; font-size: 0.65rem;
  padding: 0.1rem 0.2rem; transition: color 100ms; flex-shrink: 0; margin-top: 0.1rem;
}
.del-btn:hover { color: #f87171; }

.editor-pane { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
.empty-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem; text-align: center; padding: 2rem;
}
.empty-icon  { font-size: 2.5rem; }
.empty-title { font-size: 0.9rem; font-weight: 700; color: #e2e8f0; }
.empty-hint  { font-size: 0.8rem; color: #475569; max-width: 24rem; line-height: 1.6; }

.library-view { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.library-header { display: flex; align-items: center; justify-content: space-between; }
.lib-title { font-size: 0.875rem; font-weight: 700; color: #e2e8f0; }
.btn-new-song {
  font-size: 0.75rem; font-weight: 600; color: #818cf8; padding: 0.375rem 0.875rem;
  background: #1e1b4b; border: 1px solid #312e81; border-radius: 0.375rem; cursor: pointer;
}
.btn-new-song:hover { background: #252370; }

.lib-state { font-size: 0.82rem; color: #334155; text-align: center; padding: 2rem 0; line-height: 1.6; }
.lib-err { color: #f87171; }

.song-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.song-table thead tr { border-bottom: 1px solid #1e2040; }
.song-table th {
  padding: 0.4rem 0.5rem; text-align: left; font-size: 0.65rem; font-weight: 600;
  color: #475569; text-transform: uppercase; letter-spacing: .04em;
}
.song-table tbody tr { border-bottom: 1px solid #0f0f28; transition: background 100ms; }
.song-table tbody tr:hover { background: #0a0a1e; }
.song-table td { padding: 0.45rem 0.5rem; color: #cbd5e1; vertical-align: middle; }
.td-title { font-weight: 600; color: #e2e8f0; }
.td-meta { color: #475569; font-size: 0.75rem; }
.td-notes { font-size: 0.72rem; color: #475569; max-width: 16rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-actions { text-align: right; white-space: nowrap; }
.btn-edit {
  font-size: 0.7rem; color: #818cf8; background: transparent; border: 1px solid #312e81;
  border-radius: 0.25rem; cursor: pointer; padding: 0.15rem 0.45rem; margin-right: 0.25rem;
}
.btn-edit:hover { background: #1e1b4b; }
.btn-del {
  font-size: 0.7rem; color: #f87171; background: transparent; border: 1px solid #7f1d1d;
  border-radius: 0.25rem; cursor: pointer; padding: 0.15rem 0.45rem;
}
.btn-del:hover { background: #450a0a; }

.song-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.song-modal {
  background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.75rem;
  width: 100%; max-width: 26rem; display: flex; flex-direction: column;
}
.song-modal--sm { max-width: 22rem; }
.song-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.875rem 1rem; border-bottom: 1px solid #1e2040;
  font-size: 0.875rem; font-weight: 700; color: #e2e8f0;
}
.btn-close { background: none; border: none; cursor: pointer; color: #475569; font-size: 0.8rem; }
.song-modal-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.song-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; }
.song-form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

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

.btn-save-song {
  padding: 0.4rem 1rem; border-radius: 0.4rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
}
.btn-save-song:hover:not(:disabled) { background: #4f46e5; }
.btn-save-song:disabled { opacity: 0.4; cursor: default; }

.confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 200;
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
