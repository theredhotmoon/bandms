<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import VenueMap from '@/components/map/VenueMap.vue'
import { useBandProfile } from '@/composables/useBandProfile'
import type { Concert, ConcertBandPayload, ConcertLinkPayload, ConcertPayload } from '@/types/concert'
import type { Venue } from '@/types/venue'
import type { Band } from '@/types/band'
import type { Tag } from '@/types/tag'

const props = defineProps<{
  initial?: Concert | null
  venues: Venue[]
  bands: Band[]
  tags: Tag[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{
  submit: [payload: ConcertPayload, posterFile: File | null, deletePoster: boolean]
  cancel: []
}>()

const { query: profileQ } = useBandProfile()
const mainBandName = computed(() => profileQ.data.value?.name ?? 'Our band')

// ── Poster ────────────────────────────────────────────────────
const posterInput   = ref<HTMLInputElement | null>(null)
const posterFile    = ref<File | null>(null)
const posterPreview = ref<string | null>(null)
const posterDelete  = ref(false)

const existingPosterUrl = computed(() => props.initial?.poster_url ?? null)
const displayPoster = computed(() => posterPreview.value ?? (posterDelete.value ? null : existingPosterUrl.value))

function triggerPosterInput() { posterInput.value?.click() }

function setPosterFile(file: File) {
  posterFile.value  = file
  posterDelete.value = false
  const reader = new FileReader()
  reader.onload = (e) => { posterPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
}

function onPosterInputChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) setPosterFile(file)
}

function onPosterDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) setPosterFile(file)
}

function clearPoster() {
  posterFile.value    = null
  posterPreview.value = null
  posterDelete.value  = true
  if (posterInput.value) posterInput.value.value = ''
}

// ── Form state ────────────────────────────────────────────────
const form = reactive({
  venue_id:         0,
  date:             '',
  doors_open:       '',
  sound_check_time: '',
  start_time:       '',
  description:      '',
  tag_ids:          [] as number[],
})

interface LineupEntry {
  type: 'main' | 'band'
  id?: number
  name?: string
  play_time: string
  _initSort?: number
}

const lineup = ref<LineupEntry[]>([{ type: 'main', play_time: '' }])

const selectedVenue = computed(() => props.venues.find(v => v.id === form.venue_id) ?? null)

watch(() => props.initial, (concert) => {
  if (!concert) {
    form.venue_id         = 0
    form.date             = ''
    form.doors_open       = ''
    form.sound_check_time = ''
    form.start_time       = ''
    form.description      = ''
    form.tag_ids          = []
    links.value           = []
    lineup.value          = [{ type: 'main', play_time: '' }]
    posterFile.value      = null
    posterPreview.value   = null
    posterDelete.value    = false
    return
  }

  posterFile.value    = null
  posterPreview.value = null
  posterDelete.value  = false
  form.venue_id         = concert.venue?.id ?? 0
  form.date             = concert.date ?? ''
  form.doors_open       = concert.doors_open ?? ''
  form.sound_check_time = concert.sound_check_time ?? ''
  form.start_time       = concert.start_time ?? ''
  form.description = concert.description ?? ''
  form.tag_ids     = concert.tags?.map(t => t.id) ?? []
  links.value      = concert.links?.map(l => ({ label: l.label, url: l.url })) ?? []

  const entries: LineupEntry[] = [
    { type: 'main', play_time: concert.start_time ?? '', _initSort: concert.own_sort_order ?? 1 },
    ...(concert.bands ?? []).map(b => ({
      type: 'band' as const,
      id:         b.id,
      name:       b.name,
      play_time:  b.play_time ?? '',
      _initSort:  b.sort_order,
    })),
  ]
  entries.sort((a, b) => (a._initSort ?? 99) - (b._initSort ?? 99))
  lineup.value = entries
}, { immediate: true })

// keep main-band play_time label in sync with start_time field
watch(() => form.start_time, (t) => {
  const main = lineup.value.find(i => i.type === 'main')
  if (main) main.play_time = t
})

// ── Computed ──────────────────────────────────────────────────
const availableBands = computed(() => {
  const inLineup = new Set(lineup.value.filter(i => i.type === 'band').map(i => i.id))
  return props.bands.filter(b => !inLineup.has(b.id))
})

// ── Drag & drop ───────────────────────────────────────────────
const dragFrom      = ref<'left' | 'right' | null>(null)
const dragBandId    = ref<number | null>(null)
const dragRightIdx  = ref<number | null>(null)
const dropHoverIdx  = ref<number | null>(null)
const panelDragOver = ref(false)

function onLeftDragStart(e: DragEvent, band: Band) {
  dragFrom.value   = 'left'
  dragBandId.value = band.id
  e.dataTransfer!.effectAllowed = 'move'
}

function onRightDragStart(e: DragEvent, index: number) {
  dragFrom.value    = 'right'
  dragRightIdx.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.stopPropagation()
}

function onPanelDragEnter() { panelDragOver.value = true }
function onPanelDragLeave(e: DragEvent) {
  if (!(e.currentTarget as Element).contains(e.relatedTarget as Node | null)) {
    panelDragOver.value = false
  }
}
function onPanelDragOver(e: DragEvent) { e.preventDefault() }

function onItemDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  dropHoverIdx.value = index
}

function onPanelDrop() {
  if (dragFrom.value === 'left' && dragBandId.value !== null) {
    const band = props.bands.find(b => b.id === dragBandId.value)
    if (band) lineup.value.push({ type: 'band', id: band.id, name: band.name, play_time: '' })
  }
  resetDrag()
}

function onItemDrop(e: DragEvent, targetIdx: number) {
  e.stopPropagation()
  if (dragFrom.value === 'left' && dragBandId.value !== null) {
    const band = props.bands.find(b => b.id === dragBandId.value)
    if (band) {
      lineup.value.splice(targetIdx, 0, { type: 'band', id: band.id, name: band.name, play_time: '' })
    }
  } else if (dragFrom.value === 'right' && dragRightIdx.value !== null) {
    const src = dragRightIdx.value
    if (src === targetIdx) { resetDrag(); return }
    const [item] = lineup.value.splice(src, 1)
    const dest = src < targetIdx ? targetIdx - 1 : targetIdx
    lineup.value.splice(dest, 0, item)
  }
  resetDrag()
}

function onDragEnd() { resetDrag() }

function resetDrag() {
  dragFrom.value      = null
  dragBandId.value    = null
  dragRightIdx.value  = null
  dropHoverIdx.value  = null
  panelDragOver.value = false
}

function removeFromLineup(index: number) {
  lineup.value.splice(index, 1)
}

// ── Tags ──────────────────────────────────────────────────────
function toggleTag(id: number) {
  const idx = form.tag_ids.indexOf(id)
  if (idx === -1) form.tag_ids.push(id)
  else form.tag_ids.splice(idx, 1)
}

// ── Links ─────────────────────────────────────────────────────
const LINK_PRESETS = [
  { label: 'Buy Tickets', url: '' },
  { label: 'Facebook Event', url: '' },
  { label: 'Event Info', url: '' },
  { label: 'Live Stream', url: '' },
]

const links = ref<ConcertLinkPayload[]>([])
const newLinkLabel = ref('')
const newLinkUrl   = ref('')

function addLink() {
  const label = newLinkLabel.value.trim()
  const url   = newLinkUrl.value.trim()
  if (!label || !url) return
  links.value.push({ label, url })
  newLinkLabel.value = ''
  newLinkUrl.value   = ''
}

function addPreset(preset: { label: string; url: string }) {
  newLinkLabel.value = preset.label
  newLinkUrl.value   = ''
}

function removeLink(idx: number) {
  links.value.splice(idx, 1)
}

// ── Submit ────────────────────────────────────────────────────
function submit() {
  const bandsPayload: ConcertBandPayload[] = []
  let ownSortOrder = 1

  lineup.value.forEach((item, idx) => {
    const sortOrder = idx + 1
    if (item.type === 'main') {
      ownSortOrder = sortOrder
    } else if (item.id !== undefined) {
      bandsPayload.push({ id: item.id, sort_order: sortOrder, play_time: item.play_time || null })
    }
  })

  emit('submit', {
    venue_id:          form.venue_id,
    date:              form.date,
    doors_open:        form.doors_open       || null,
    sound_check_time:  form.sound_check_time || null,
    start_time:        form.start_time       || null,
    own_sort_order:    ownSortOrder,
    description:       form.description || null,
    bands:             bandsPayload,
    tag_ids:           form.tag_ids,
    links:             links.value,
  }, posterFile.value, posterDelete.value)
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-5">

    <!-- Venue -->
    <div>
      <label class="field-label">Venue <span style="color:#f87171;">*</span></label>
      <select v-model="form.venue_id" required class="field-input">
        <option :value="0" disabled>Select a venue…</option>
        <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
      </select>
      <p v-if="errors?.venue_id" class="field-error">{{ errors.venue_id[0] }}</p>

      <!-- Venue detail card -->
      <div v-if="selectedVenue" class="venue-card">
        <div class="venue-info">
          <p class="venue-name">{{ selectedVenue.name }}</p>
          <p v-if="selectedVenue.street || selectedVenue.city" class="venue-addr">
            {{ [selectedVenue.street, selectedVenue.street_number].filter(Boolean).join(' ') }}
            <span v-if="selectedVenue.street && selectedVenue.city"> · </span>
            {{ [selectedVenue.postcode, selectedVenue.city].filter(Boolean).join(' ') }}
          </p>
          <p v-if="selectedVenue.additional_info" class="venue-extra">{{ selectedVenue.additional_info }}</p>
          <p v-if="selectedVenue.latitude == null" class="venue-no-coords">No map coordinates set for this venue.</p>
        </div>
        <div v-if="selectedVenue.latitude != null" class="venue-map-wrap">
          <VenueMap
            :latitude="selectedVenue.latitude"
            :longitude="selectedVenue.longitude"
            :editable="false"
          />
        </div>
      </div>
    </div>

    <!-- Date + times -->
    <div class="time-grid">
      <div>
        <label class="field-label">Date <span style="color:#f87171;">*</span></label>
        <input v-model="form.date" type="date" required class="field-input" />
        <p v-if="errors?.date" class="field-error">{{ errors.date[0] }}</p>
      </div>
      <div>
        <label class="field-label">Doors open</label>
        <input v-model="form.doors_open" type="time" class="field-input" />
        <p v-if="errors?.doors_open" class="field-error">{{ errors.doors_open[0] }}</p>
      </div>
      <div>
        <label class="field-label">Sound check <span class="label-note">(our band)</span></label>
        <input v-model="form.sound_check_time" type="time" class="field-input" />
        <p v-if="errors?.sound_check_time" class="field-error">{{ errors.sound_check_time[0] }}</p>
      </div>
      <div>
        <label class="field-label">Band start time <span class="label-note">(our band)</span></label>
        <input v-model="form.start_time" type="time" class="field-input" />
        <p v-if="errors?.start_time" class="field-error">{{ errors.start_time[0] }}</p>
      </div>
    </div>

    <!-- Lineup builder -->
    <div>
      <label class="field-label">Lineup</label>
      <div class="lineup-cols">

        <!-- Left: available bands -->
        <div class="band-pool">
          <p class="panel-title">Available bands</p>
          <div
            v-for="band in availableBands"
            :key="band.id"
            class="pool-chip"
            draggable="true"
            @dragstart="onLeftDragStart($event, band)"
            @dragend="onDragEnd"
          >
            <span class="drag-dots">⠿</span>
            <span>{{ band.name }}</span>
          </div>
          <p v-if="!availableBands.length" class="empty-note">
            {{ bands.length ? 'All bands added' : 'No bands yet' }}
          </p>
        </div>

        <!-- Right: lineup -->
        <div
          class="lineup-panel"
          :class="{ 'drag-over': panelDragOver && dragFrom === 'left' }"
          @dragenter="onPanelDragEnter"
          @dragleave="onPanelDragLeave"
          @dragover="onPanelDragOver"
          @drop="onPanelDrop"
        >
          <p class="panel-title">Concert lineup <span class="panel-hint">(drag to reorder)</span></p>

          <div
            v-for="(item, idx) in lineup"
            :key="item.type === 'main' ? 'main' : item.id"
            class="lineup-item"
            :class="{
              'is-main':    item.type === 'main',
              'drop-above': dropHoverIdx === idx,
            }"
            draggable="true"
            @dragstart="onRightDragStart($event, idx)"
            @dragend="onDragEnd"
            @dragover="onItemDragOver($event, idx)"
            @drop="onItemDrop($event, idx)"
          >
            <span class="drag-dots">⠿</span>
            <span class="item-name">
              {{ item.type === 'main' ? mainBandName : item.name }}
              <span v-if="item.type === 'main'" class="main-badge">us</span>
            </span>
            <span class="item-time">
              <template v-if="item.type === 'main'">
                <span class="time-auto" :class="{ dim: !form.start_time }">
                  {{ form.start_time || '—' }}
                </span>
                <span class="time-auto-label">↑ band start</span>
              </template>
              <input
                v-else
                v-model="item.play_time"
                type="time"
                class="play-time-input"
                placeholder="--:--"
                title="Approximate set time"
              />
            </span>
            <button
              v-if="item.type !== 'main'"
              type="button"
              class="remove-btn"
              title="Remove from lineup"
              @click="removeFromLineup(idx)"
            >×</button>
          </div>

          <p v-if="!lineup.length" class="empty-note">Drop bands here to build the lineup</p>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div>
      <label class="field-label">Description</label>
      <textarea v-model="form.description" class="field-input" rows="2" placeholder="Optional description…" />
      <p v-if="errors?.description" class="field-error">{{ errors.description[0] }}</p>
    </div>

    <!-- Tags -->
    <div>
      <label class="field-label">Tags</label>
      <div class="checkbox-list">
        <label v-for="t in tags" :key="t.id" class="checkbox-item">
          <input type="checkbox" :checked="form.tag_ids.includes(t.id)" @change="toggleTag(t.id)" />
          <span>{{ t.name }}</span>
        </label>
        <p v-if="!tags.length" class="text-xs" style="color:#475569;">No tags available.</p>
      </div>
    </div>

    <!-- Links -->
    <div>
      <label class="field-label">Links</label>

      <!-- Existing links list -->
      <div v-if="links.length" class="links-list">
        <div v-for="(link, idx) in links" :key="idx" class="link-row">
          <span class="link-label">{{ link.label }}</span>
          <a :href="link.url" target="_blank" rel="noopener" class="link-url">{{ link.url }}</a>
          <button type="button" class="remove-btn" @click="removeLink(idx)">×</button>
        </div>
      </div>

      <!-- Quick-pick presets -->
      <div class="link-presets">
        <button
          v-for="p in LINK_PRESETS"
          :key="p.label"
          type="button"
          class="preset-chip"
          :class="{ active: newLinkLabel === p.label }"
          @click="addPreset(p)"
        >{{ p.label }}</button>
      </div>

      <!-- Add new link row -->
      <div class="link-add-row">
        <input
          v-model="newLinkLabel"
          class="field-input link-label-input"
          placeholder="Label"
        />
        <input
          v-model="newLinkUrl"
          type="url"
          class="field-input link-url-input"
          placeholder="https://…"
          @keydown.enter.prevent="addLink"
        />
        <button type="button" class="btn-add-link" @click="addLink">Add</button>
      </div>
    </div>

    <!-- Concert poster -->
    <div>
      <label class="field-label">Concert poster</label>
      <div
        class="poster-drop"
        :class="{ 'has-image': displayPoster }"
        @click="triggerPosterInput"
        @dragover.prevent
        @drop="onPosterDrop"
      >
        <img v-if="displayPoster" :src="displayPoster" class="poster-img" alt="Concert poster" />
        <div v-else class="poster-placeholder">
          <svg class="poster-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="poster-hint">Click or drop image</span>
          <span class="poster-sub">JPG · PNG · WebP · max 4 MB</span>
        </div>
        <input
          ref="posterInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style="display:none"
          @change="onPosterInputChange"
        />
      </div>
      <div v-if="displayPoster" class="poster-clear-row">
        <button type="button" class="btn-poster-clear" @click.stop="clearPoster">Remove poster</button>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update' : 'Create') }}
      </button>
    </div>

  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
/* ── Venue card ─────────────────────────────────────────────── */
.venue-card {
  margin-top: 0.625rem;
  border: 1px solid #1e2040;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #0e0e26;
}
.venue-info {
  padding: 0.625rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.venue-name  { font-size: 0.875rem; font-weight: 600; color: #e2e8f0; margin: 0; }
.venue-addr  { font-size: 0.8rem;   color: #94a3b8;  margin: 0; }
.venue-extra { font-size: 0.75rem;  color: #64748b;  margin: 0; }
.venue-no-coords { font-size: 0.7rem; color: #475569; margin: 0; }
.venue-map-wrap { border-top: 1px solid #1a1a38; }
.venue-map-wrap :deep(.venue-map) { height: 180px; }

/* ── Date / time grid ───────────────────────────────────────── */
.time-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr;
  gap: 0.75rem;
}
.label-note {
  font-weight: 400;
  font-size: 0.68rem;
  color: #4338ca;
  margin-left: 0.2rem;
}

/* ── Lineup builder ─────────────────────────────────────────── */
.lineup-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
  min-height: 200px;
}

.band-pool,
.lineup-panel {
  border: 1px solid #1e2040;
  border-radius: 0.5rem;
  background: #0e0e26;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 180px;
  max-height: 320px;
  overflow-y: auto;
}

.lineup-panel.drag-over {
  border-color: #6366f1;
  background: #0b0b20;
}

.panel-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.25rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #1a1a38;
}
.panel-hint { font-weight: 400; text-transform: none; letter-spacing: 0; color: #334155; }

.empty-note { font-size: 0.75rem; color: #334155; margin: auto 0; text-align: center; padding: 0.5rem; }

/* Pool chips */
.pool-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.375rem;
  background: #0f0f26;
  border: 1px solid #1e1e40;
  font-size: 0.8125rem;
  color: #cbd5e1;
  cursor: grab;
  user-select: none;
  transition: background 100ms, border-color 100ms;
}
.pool-chip:hover { background: #161630; border-color: #1e2040; }
.pool-chip:active { cursor: grabbing; }

/* Lineup items */
.lineup-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.375rem;
  background: #0f0f26;
  border: 1px solid #1e1e40;
  font-size: 0.8125rem;
  color: #cbd5e1;
  cursor: grab;
  user-select: none;
  transition: background 100ms, border-color 100ms;
}
.lineup-item:hover { background: #161630; border-color: #1e2040; }
.lineup-item.is-main {
  background: #1e1b4b;
  border-color: #4338ca;
  color: #a5b4fc;
  cursor: grab;
}
.lineup-item.drop-above { border-top: 2px solid #6366f1; }

.drag-dots { font-size: 0.875rem; color: #334155; flex-shrink: 0; line-height: 1; }
.is-main .drag-dots { color: #4338ca; }

.item-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.main-badge {
  display: inline-block;
  margin-left: 0.3rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #4338ca;
  color: #c7d2fe;
  vertical-align: middle;
}

.item-time {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}
.time-auto {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: #818cf8;
  min-width: 3rem;
  text-align: right;
}
.time-auto.dim { color: #334155; }
.time-auto-label { font-size: 0.6rem; color: #334155; }

.play-time-input {
  width: 5.5rem;
  padding: 0.2rem 0.375rem;
  border-radius: 0.375rem;
  border: 1px solid #1e2040;
  background: #0e0e26;
  color: #e2e8f0;
  font-size: 0.8rem;
  outline: none;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}
.play-time-input:focus { border-color: #6366f1; }

.remove-btn {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 1rem;
  cursor: pointer;
  line-height: 1;
  transition: background 100ms, color 100ms;
}
.remove-btn:hover { background: #3b1212; color: #f87171; }

/* ── Concert poster ─────────────────────────────────────────── */
.poster-drop {
  border: 2px dashed #1e2040;
  border-radius: 0.5rem;
  background: #0e0e26;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 150ms, background 150ms;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.poster-drop:hover { border-color: #6366f1; background: #0b0b20; }
.poster-drop.has-image { border-style: solid; border-color: #1e2040; min-height: 0; }

.poster-img {
  display: block;
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  background: #050510;
}

.poster-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1.5rem;
}
.poster-icon { width: 2rem; height: 2rem; color: #334155; }
.poster-hint { font-size: 0.8125rem; color: #475569; }
.poster-sub  { font-size: 0.7rem; color: #334155; }

.poster-clear-row { margin-top: 0.375rem; display: flex; justify-content: flex-end; }
.btn-poster-clear {
  font-size: 0.75rem;
  color: #f87171;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.125rem 0;
  transition: color 120ms;
}
.btn-poster-clear:hover { color: #fca5a5; }

/* ── Links ──────────────────────────────────────────────────── */
.links-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.5rem;
}
.link-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.375rem;
  background: #0e0e26;
  border: 1px solid #1e1e40;
  font-size: 0.8125rem;
}
.link-label {
  flex-shrink: 0;
  min-width: 7rem;
  color: #a5b4fc;
  font-weight: 500;
}
.link-url {
  flex: 1;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
  font-size: 0.75rem;
}
.link-url:hover { color: #94a3b8; }

.link-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}
.preset-chip {
  padding: 0.2rem 0.625rem;
  border-radius: 999px;
  border: 1px solid #1e2040;
  background: #0e0e26;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 100ms, color 100ms, background 100ms;
}
.preset-chip:hover, .preset-chip.active {
  border-color: #6366f1;
  color: #a5b4fc;
  background: #13123a;
}

.link-add-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.link-label-input { flex: 0 0 9rem; }
.link-url-input   { flex: 1; }
.btn-add-link {
  flex-shrink: 0;
  padding: 0.4rem 0.875rem;
  border-radius: 0.375rem;
  border: 1px solid #4338ca;
  background: #1e1b4b;
  color: #a5b4fc;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: background 100ms, border-color 100ms;
}
.btn-add-link:hover { background: #1e2040; border-color: #6366f1; }
</style>
