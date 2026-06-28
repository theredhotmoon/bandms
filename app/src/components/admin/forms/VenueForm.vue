<script setup lang="ts">
import { reactive, watch, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { Map as LMap, Marker } from 'leaflet'
import type { Venue, VenuePayload } from '@/types/venue'
import type { Tag } from '@/types/tag'

const props = defineProps<{
  initial?: Venue | null
  tags: Tag[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [VenuePayload]; cancel: [] }>()

const form = reactive({
  name:            '',
  street:          '',
  street_number:   '',
  city:            '',
  postcode:        '',
  additional_info: '',
  capacity:        '' as string,
  latitude:        '' as string,
  longitude:       '' as string,
  tag_ids:         [] as number[],
})

// ── Map ───────────────────────────────────────────────────────
const mapEl = ref<HTMLElement | null>(null)
let lmap:    LMap   | null = null
let marker:  Marker | null = null

const searchQuery   = ref('')
const searching     = ref(false)
const searchResults = ref<{ label: string; lat: string; lon: string }[]>([])
const showResults   = ref(false)

const DEFAULT_LAT = 50.0647
const DEFAULT_LNG = 19.9450

function latNum() { return form.latitude  !== '' ? parseFloat(form.latitude)  : null }
function lngNum() { return form.longitude !== '' ? parseFloat(form.longitude) : null }

async function initMap() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
    shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
  })

  const lat = latNum() ?? DEFAULT_LAT
  const lng = lngNum() ?? DEFAULT_LNG

  lmap = L.map(mapEl.value!).setView([lat, lng], latNum() !== null ? 14 : 6)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(lmap)

  if (latNum() !== null) {
    marker = L.marker([lat, lng]).addTo(lmap)
  }

  lmap.on('click', (e) => {
    const { lat: clat, lng: clng } = e.latlng
    form.latitude  = String(Math.round(clat * 1e6) / 1e6)
    form.longitude = String(Math.round(clng * 1e6) / 1e6)
    placeMarker(clat, clng)
  })
}

function placeMarker(lat: number, lng: number) {
  if (!lmap) return
  import('leaflet').then(({ default: L }) => {
    if (marker) marker.setLatLng([lat, lng])
    else        marker = L.marker([lat, lng]).addTo(lmap!)
    lmap!.setView([lat, lng], Math.max(lmap!.getZoom(), 14))
  })
}

async function searchPlace() {
  const q = searchQuery.value.trim()
  if (!q) return
  searching.value = true
  searchResults.value = []
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    const data = await res.json() as {
      lat: string
      lon: string
      display_name: string
      address?: {
        road?: string
        house_number?: string
        city?: string
        town?: string
        village?: string
        postcode?: string
      }
    }[]
    searchResults.value = data.map(r => ({
      label: r.display_name.split(',').slice(0, 3).join(',').trim(),
      lat:   r.lat,
      lon:   r.lon,
      addr:  r.address,
    })) as typeof searchResults.value
    showResults.value = searchResults.value.length > 0
  } catch {
    // silently fail
  } finally {
    searching.value = false
  }
}

interface NominatimResult {
  label: string
  lat: string
  lon: string
  addr?: {
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    postcode?: string
  }
}

function pickResult(r: NominatimResult) {
  form.latitude  = String(Math.round(parseFloat(r.lat) * 1e6) / 1e6)
  form.longitude = String(Math.round(parseFloat(r.lon) * 1e6) / 1e6)

  // Auto-fill address fields from Nominatim addressdetails
  if (r.addr) {
    if (r.addr.road)         form.street        = r.addr.road
    if (r.addr.house_number) form.street_number = r.addr.house_number
    if (r.addr.city || r.addr.town || r.addr.village)
      form.city = r.addr.city ?? r.addr.town ?? r.addr.village ?? ''
    if (r.addr.postcode)     form.postcode      = r.addr.postcode
  }

  placeMarker(parseFloat(r.lat), parseFloat(r.lon))
  searchQuery.value = r.label
  showResults.value = false
}

// ── Props sync ────────────────────────────────────────────────
watch(() => props.initial, (val) => {
  form.name            = val?.name            ?? ''
  form.street          = val?.street          ?? ''
  form.street_number   = val?.street_number   ?? ''
  form.city            = val?.city            ?? ''
  form.postcode        = val?.postcode        ?? ''
  form.additional_info = val?.additional_info ?? ''
  form.capacity        = val?.capacity != null ? String(val.capacity) : ''
  form.latitude        = val?.latitude  != null ? String(val.latitude)  : ''
  form.longitude       = val?.longitude != null ? String(val.longitude) : ''
  form.tag_ids         = val?.tags?.map(t => t.id) ?? []

  if (lmap && val?.latitude != null) {
    nextTick(() => placeMarker(val.latitude!, val.longitude!))
  }
}, { immediate: true })

function toggleTag(id: number) {
  const idx = form.tag_ids.indexOf(id)
  if (idx === -1) form.tag_ids.push(id)
  else form.tag_ids.splice(idx, 1)
}

function submit() {
  emit('submit', {
    name:            form.name,
    street:          form.street          || null,
    street_number:   form.street_number   || null,
    city:            form.city            || null,
    postcode:        form.postcode        || null,
    additional_info: form.additional_info || null,
    capacity:        form.capacity !== '' ? parseInt(form.capacity, 10) : null,
    latitude:        form.latitude  !== '' ? parseFloat(form.latitude)  : null,
    longitude:       form.longitude !== '' ? parseFloat(form.longitude) : null,
    tag_ids:         form.tag_ids,
  })
}

onMounted(() => nextTick(initMap))
onBeforeUnmount(() => { lmap?.remove(); lmap = null; marker = null })
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <!-- Name -->
    <div>
      <label class="field-label">Name <span style="color:#f87171;">*</span></label>
      <input v-model="form.name" required class="field-input" placeholder="Venue name" />
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>

    <!-- Structured address -->
    <div class="address-grid">
      <div class="col-street">
        <label class="field-label">Street</label>
        <input v-model="form.street" class="field-input" placeholder="ul. Floriańska" />
        <p v-if="errors?.street" class="field-error">{{ errors.street[0] }}</p>
      </div>
      <div class="col-number">
        <label class="field-label">No.</label>
        <input v-model="form.street_number" class="field-input" placeholder="12" />
        <p v-if="errors?.street_number" class="field-error">{{ errors.street_number[0] }}</p>
      </div>
      <div class="col-postcode">
        <label class="field-label">Postcode</label>
        <input v-model="form.postcode" class="field-input" placeholder="31-021" />
        <p v-if="errors?.postcode" class="field-error">{{ errors.postcode[0] }}</p>
      </div>
      <div class="col-city">
        <label class="field-label">City</label>
        <input v-model="form.city" class="field-input" placeholder="Kraków" />
        <p v-if="errors?.city" class="field-error">{{ errors.city[0] }}</p>
      </div>
    </div>
    <div>
      <label class="field-label">Additional info</label>
      <input v-model="form.additional_info" class="field-input" placeholder="Floor, entrance, parking notes…" />
      <p v-if="errors?.additional_info" class="field-error">{{ errors.additional_info[0] }}</p>
    </div>
    <div>
      <label class="field-label">Venue capacity</label>
      <input v-model="form.capacity" type="number" min="1" class="field-input" placeholder="e.g. 500" style="max-width:12rem;" />
      <p v-if="errors?.capacity" class="field-error">{{ errors.capacity[0] }}</p>
    </div>

    <!-- Map + search -->
    <div>
      <label class="field-label">Location on map</label>
      <div class="map-search-row">
        <input
          v-model="searchQuery"
          class="field-input"
          placeholder="Search for a place…"
          @keydown.enter.prevent="searchPlace"
          @keydown.escape="showResults = false"
        />
        <button type="button" class="btn-search" :disabled="searching" @click="searchPlace">
          {{ searching ? '…' : 'Search' }}
        </button>
      </div>
      <div v-if="showResults" class="search-results">
        <button
          v-for="r in searchResults"
          :key="r.lat + r.lon"
          type="button"
          class="result-item"
          @click="pickResult(r as any)"
        >{{ r.label }}</button>
      </div>
      <div ref="mapEl" class="map-container" />
      <p class="map-hint">Click the map to pin coordinates, or use the search above (address fields are auto-filled).</p>
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
/* Address grid: street(flex) | number(fixed) on row 1, postcode(fixed) | city(flex) on row 2 */
.address-grid {
  display: grid;
  grid-template-columns: 1fr 5.5rem 7rem 1fr;
  grid-template-rows: auto auto;
  gap: 0.5rem 0.625rem;
}
.col-street   { grid-column: 1 / 2; }
.col-number   { grid-column: 2 / 3; }
.col-postcode { grid-column: 3 / 4; }
.col-city     { grid-column: 4 / 5; }

.map-search-row { display: flex; gap: 0.5rem; margin-bottom: 0.375rem; }
.map-search-row .field-input { flex: 1; }

.btn-search {
  padding: 0.5rem 0.875rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; background: #2a2a2a; border: 1px solid #888888; color: #d0d0d0;
  transition: background 120ms; white-space: nowrap; flex-shrink: 0;
}
.btn-search:hover:not(:disabled) { background: #2e2a6e; }
.btn-search:disabled { opacity: 0.5; cursor: default; }

.search-results {
  background: #111111; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  margin-bottom: 0.375rem; overflow: hidden; display: flex; flex-direction: column;
}
.result-item {
  padding: 0.5rem 0.75rem; font-size: 0.8rem; color: #cbd5e1;
  background: transparent; border: none; text-align: left; cursor: pointer;
  transition: background 100ms; border-bottom: 1px solid #222222;
}
.result-item:last-child { border-bottom: none; }
.result-item:hover { background: #1a1a1a; color: #d0d0d0; }

.map-container {
  height: 240px; border-radius: 0.5rem; overflow: hidden;
  border: 1px solid #2a2a2a; margin-bottom: 0.375rem;
}
.map-hint { font-size: 0.7rem; color: #334155; margin: 0; }
</style>
