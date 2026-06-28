<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Pin {
  id: number
  slug: string
  lat: number
  lng: number
  city: string | null
  venue: string
  date: string
  upcoming: boolean
}

const props = defineProps<{
  concerts: Pin[]
  accent: string
}>()

const mapEl = ref<HTMLDivElement>()
let map: any
let markerById: Record<number, any> = {}

const INK = '#121212'
const PAPER = '#EFE7D6'

function pinHTML(upcoming: boolean, accent: string) {
  if (upcoming) {
    return `<div class="ss-pin up">
      <span class="ss-ring" style="border-color:${accent}"></span>
      <span class="ss-dot" style="background:${accent};border:3px solid ${INK};width:20px;height:20px;border-radius:50%;position:relative;z-index:2;display:block;box-shadow:0 2px 5px rgba(0,0,0,.4)"></span>
    </div>`
  }
  return `<div class="ss-pin">
    <span class="ss-dot" style="background:${INK};border:2px solid ${PAPER};width:15px;height:15px;border-radius:50%;display:block;box-shadow:0 2px 5px rgba(0,0,0,.4);opacity:.92"></span>
  </div>`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate().toString().padStart(2, '0')
  const mo = d.toLocaleDateString('en-GB', { month: 'short' })
  const yr = d.getFullYear()
  return `${day} ${mo} ${yr}`
}

function popupHTML(c: Pin, accent: string) {
  const badge = c.upcoming
    ? `<span style="background:${accent};color:#fff;font:800 9px/1 Archivo,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:4px 7px;">Upcoming</span>`
    : `<span style="background:${INK};color:${PAPER};font:800 9px/1 Archivo,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:4px 7px;">Played</span>`
  return `<div style="min-width:180px;font-family:Archivo,sans-serif;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      ${badge}
      <span style="font:700 11px/1 Archivo,sans-serif;color:#666;letter-spacing:.04em;">${formatDate(c.date)}</span>
    </div>
    <div style="font:400 22px/0.95 Anton,sans-serif;text-transform:uppercase;letter-spacing:.01em;color:${INK};">${c.city ?? ''}</div>
    <div style="font:600 13px/1.3 Archivo,sans-serif;color:#333;margin-top:4px;">${c.venue}</div>
    <a href="/concerts/${c.slug}" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;background:${INK};color:${PAPER};font:400 14px/1 Anton,sans-serif;text-transform:uppercase;letter-spacing:.02em;padding:9px 12px;text-decoration:none;">View details →</a>
  </div>`
}

onMounted(async () => {
  if (!mapEl.value || !props.concerts.length) return

  const L = (await import('leaflet')).default
  // Import leaflet CSS
  const linkEl = document.createElement('link')
  linkEl.rel = 'stylesheet'
  linkEl.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(linkEl)

  // Custom popup styles
  const styleEl = document.createElement('style')
  styleEl.textContent = `
    .ss-pin { position:relative;width:30px;height:30px;display:grid;place-items:center; }
    .ss-pin .ss-ring { position:absolute;width:20px;height:20px;border-radius:50%;border:2px solid;z-index:1; }
    @keyframes sspulse { 0% { transform:scale(.6);opacity:.7; } 100% { transform:scale(2.4);opacity:0; } }
    .ss-pin.up .ss-ring { animation:sspulse 1.8s ease-out infinite; }
    .leaflet-container { background:${PAPER} !important;font-family:Archivo,sans-serif; }
    .leaflet-tile-pane { filter:grayscale(1) contrast(0.92) sepia(0.22) brightness(1.03); }
    .leaflet-bar a,.leaflet-bar a:hover { background:${INK};color:${PAPER};border-bottom-color:#3a3a3a;width:30px;height:30px;line-height:30px;font-weight:700; }
    .leaflet-bar { border:2px solid ${INK};border-radius:0;box-shadow:4px 4px 0 rgba(0,0,0,.3); }
    .leaflet-bar a:first-child,.leaflet-bar a:last-child { border-radius:0; }
    .leaflet-popup-content-wrapper { background:${PAPER};color:${INK};border:3px solid ${INK};border-radius:0;box-shadow:8px 8px 0 ${props.accent}; }
    .leaflet-popup-tip { background:${INK}; }
    .leaflet-popup-content { margin:13px 15px; }
    .leaflet-popup-close-button { color:${INK} !important;font-size:19px !important;padding:5px 7px 0 0 !important; }
    .leaflet-control-attribution { background:rgba(239,231,214,.8) !important;font-size:9px; }
  `
  document.head.appendChild(styleEl)

  await new Promise(r => setTimeout(r, 60))

  map = L.map(mapEl.value, { scrollWheelZoom: false, zoomControl: true })

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 12,
    subdomains: 'abcd',
    attribution: '© OpenStreetMap © CARTO',
  }).addTo(map)

  markerById = {}
  for (const c of props.concerts) {
    const icon = L.divIcon({
      className: '',
      html: pinHTML(c.upcoming, props.accent),
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -12],
    })
    const mk = L.marker([c.lat, c.lng], { icon, riseOnHover: true, zIndexOffset: c.upcoming ? 1000 : 0 })
    mk.bindPopup(popupHTML(c, props.accent), { closeButton: true, minWidth: 200, maxWidth: 240 })
    mk.addTo(map)
    markerById[c.id] = mk
  }

  if (props.concerts.length === 1) {
    map.setView([props.concerts[0].lat, props.concerts[0].lng], 9)
  } else {
    const bounds = props.concerts.map(c => [c.lat, c.lng] as [number, number])
    map.fitBounds(bounds, { padding: [50, 50] })
  }

  window.addEventListener('ss:fly-to', handleFlyTo)
})

function handleFlyTo(e: Event) {
  const id = (e as CustomEvent<{ id: number }>).detail.id
  const mk = markerById[id]
  const concert = props.concerts.find(c => c.id === id)
  if (!mk || !concert || !map) return
  map.flyTo([concert.lat, concert.lng], 13, { animate: true, duration: 0.7 })
  setTimeout(() => mk.openPopup(), 750)
}

onUnmounted(() => {
  window.removeEventListener('ss:fly-to', handleFlyTo)
  map?.remove()
})
</script>

<template>
  <div ref="mapEl" style="height:520px;width:100%;background:#EFE7D6;position:relative;">
    <!-- legend -->
    <div style="position:absolute;top:14px;right:14px;z-index:500;background:#EFE7D6;border:3px solid #121212;box-shadow:5px 5px 0 v-bind(accent);padding:12px 14px;display:flex;flex-direction:column;gap:9px;">
      <span style="display:flex;align-items:center;gap:9px;font:800 12px/1 Archivo,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#121212;">
        <span :style="`width:16px;height:16px;border-radius:50%;background:${accent};border:2px solid #121212;display:inline-block;`"></span>Upcoming
      </span>
      <span style="display:flex;align-items:center;gap:9px;font:800 12px/1 Archivo,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#121212;">
        <span style="width:14px;height:14px;border-radius:50%;background:#121212;border:2px solid #EFE7D6;outline:1px solid #121212;display:inline-block;"></span>Played
      </span>
    </div>
  </div>
</template>
