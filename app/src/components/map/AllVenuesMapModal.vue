<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { Concert } from '@/types/concert'

interface Props {
  concerts: Concert[]
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

type Filter = 'all' | 'upcoming' | 'past'
const filter = ref<Filter>('all')
const mapContainer = ref<HTMLElement | null>(null)

const today = new Date()
today.setHours(0, 0, 0, 0)

const filtered = computed(() => {
  return props.concerts.filter(c => {
    const d = new Date(c.date + 'T00:00:00')
    if (filter.value === 'upcoming') return d >= today
    if (filter.value === 'past')     return d < today
    return true
  })
})

// Group concerts by venue (lat/lng key)
const venueGroups = computed(() => {
  const map = new Map<string, Concert[]>()
  for (const c of filtered.value) {
    const { latitude, longitude } = c.venue
    if (latitude == null || longitude == null) continue
    const key = `${latitude},${longitude}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }
  return map
})

let leafletMap: import('leaflet').Map | null = null
let L: typeof import('leaflet') | null = null

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
}

function buildPopupHtml(concerts: Concert[]): string {
  return concerts.map(c => {
    const bands = c.bands.length ? `<div style="font-size:0.78rem;opacity:0.65;margin-top:2px;">${c.bands.map(b => b.name).join(', ')}</div>` : ''
    return `<div style="padding:2px 0;border-bottom:1px solid #eee;margin-bottom:4px;">
      <div style="font-weight:600;font-size:0.82rem;">${formatDate(c.date)}</div>
      <div style="font-size:0.82rem;">${c.venue.name}${c.venue.city ? ` · ${c.venue.city}` : ''}</div>
      ${bands}
    </div>`
  }).join('')
}

async function initMap() {
  if (!mapContainer.value) return
  L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  leafletMap = L.map(mapContainer.value, { zoomControl: true }).setView([50, 15], 4)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(leafletMap)

  renderMarkers()
}

function pinIcon(fill: string, stroke: string): import('leaflet').DivIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
      fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="5.5" fill="white" opacity="0.9"/>
  </svg>`
  return L!.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -42],
  })
}

function renderMarkers() {
  if (!leafletMap || !L) return

  // Remove existing layers except tile layer
  leafletMap.eachLayer(layer => {
    if ((layer as any)._url === undefined) leafletMap!.removeLayer(layer)
  })

  const bounds: [number, number][] = []

  for (const [key, concerts] of venueGroups.value.entries()) {
    const [latStr, lngStr] = key.split(',')
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)
    bounds.push([lat, lng])

    const allPast = concerts.every(c => new Date(c.date + 'T00:00:00') < today)
    const fill    = allPast ? '#777' : '#111'
    const stroke = allPast ? '#555' : '#000'

    const marker = L!.marker([lat, lng], { icon: pinIcon(fill, stroke) }).addTo(leafletMap!)

    const popupContent = `<div style="min-width:170px;max-width:260px;font-family:inherit;">${buildPopupHtml(concerts)}</div>`
    marker.bindPopup(popupContent, { closeButton: false, maxWidth: 280 })
    marker.on('mouseover', () => marker.openPopup())
    marker.on('mouseout',  () => marker.closePopup())
    marker.on('click',     () => marker.openPopup())
  }

  if (bounds.length) {
    leafletMap!.fitBounds(bounds, { padding: [48, 48] })
  }
}

watch(filter, () => renderMarkers())

watch(
  () => props.concerts,
  () => renderMarkers(),
)

onMounted(async () => {
  await nextTick()
  await initMap()
})

onUnmounted(() => {
  leafletMap?.remove()
  leafletMap = null
})

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click="onBackdropClick">
      <div class="modal-box" role="dialog" aria-modal="true" aria-label="Venues map">
        <!-- Header -->
        <div class="modal-header">
          <span class="modal-title">Where we played</span>

          <div class="filter-tabs">
            <button
              v-for="opt in ([
                { key: 'all',      label: 'All concerts' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'past',     label: 'Past shows' },
              ] as const)"
              :key="opt.key"
              class="filter-btn"
              :class="{ 'filter-btn--active': filter === opt.key }"
              @click="filter = opt.key"
            >
              {{ opt.label }}
            </button>
          </div>

          <button class="close-btn" aria-label="Close" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Map -->
        <div ref="mapContainer" class="map-container" />

        <!-- Legend -->
        <div class="modal-footer">
          <span class="legend-item"><span class="dot dot--active" />Upcoming</span>
          <span class="legend-item"><span class="dot dot--past" />Past</span>
          <span class="venues-count">{{ venueGroups.size }} venue{{ venueGroups.size !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}

.modal-box {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  width: 100%;
  max-width: 860px;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem 0.875rem 1.25rem;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.modal-title {
  font-weight: 700;
  font-size: 0.9375rem;
  color: #111;
  flex-shrink: 0;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
  flex: 1;
}

.filter-btn {
  padding: 0.3rem 0.7rem;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 500;
  background: transparent;
  border: 1px solid #e0e0e0;
  color: #666;
  cursor: pointer;
  transition: background 100ms, color 100ms, border-color 100ms;
}
.filter-btn:hover        { background: #f5f5f5; color: #111; }
.filter-btn--active      { background: #111; color: #fff; border-color: #111; }

.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 6px;
  background: transparent; border: none; cursor: pointer; color: #888;
  transition: background 100ms, color 100ms;
  flex-shrink: 0;
}
.close-btn:hover { background: #f5f5f5; color: #111; }

.map-container {
  flex: 1;
  min-height: 420px;
  width: 100%;
}

/* Black & white map tiles */
.map-container :deep(.leaflet-layer) {
  filter: grayscale(1) contrast(1.05) brightness(1.05);
}
/* Keep popups in colour */
.map-container :deep(.leaflet-pane.leaflet-popup-pane) {
  filter: none;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1.25rem;
  border-top: 1px solid #e8e8e8;
  flex-shrink: 0;
  font-size: 0.78rem;
  color: #777;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.dot {
  display: inline-block;
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #aaa;
}
.dot--active { background: #111; }
.dot--past   { background: #888; }

.venues-count {
  margin-left: auto;
  font-weight: 500;
  color: #aaa;
}

@media (max-width: 600px) {
  .modal-header  { flex-wrap: wrap; }
  .filter-tabs   { order: 3; flex-basis: 100%; }
  .map-container { min-height: 300px; }
}
</style>
