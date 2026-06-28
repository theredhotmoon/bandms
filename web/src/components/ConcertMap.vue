<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  lat: number
  lng: number
  venueName: string
  city: string | null
  accent: string
  upcoming: boolean
}>()

const mapEl = ref<HTMLDivElement>()
let map: any

const INK = '#121212'
const PAPER = '#EFE7D6'

onMounted(async () => {
  if (!mapEl.value) return

  const L = (await import('leaflet')).default

  const linkEl = document.createElement('link')
  linkEl.rel = 'stylesheet'
  linkEl.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  if (!document.querySelector('link[href*="leaflet"]')) document.head.appendChild(linkEl)

  const styleEl = document.createElement('style')
  styleEl.textContent = `
    .ss-cmap .leaflet-container { background:${PAPER} !important; }
    .ss-cmap .leaflet-tile-pane { filter:grayscale(1) contrast(0.92) sepia(0.22) brightness(1.03); }
    .ss-cmap .leaflet-bar a { background:${INK};color:${PAPER};border-bottom-color:#3a3a3a;width:28px;height:28px;line-height:28px;font-weight:700; }
    .ss-cmap .leaflet-bar { border:2px solid ${INK};border-radius:0;box-shadow:3px 3px 0 rgba(0,0,0,.3); }
    .ss-cmap .leaflet-bar a:first-child,.ss-cmap .leaflet-bar a:last-child { border-radius:0; }
    .ss-cmap .leaflet-popup-content-wrapper { background:${PAPER};color:${INK};border:3px solid ${INK};border-radius:0;box-shadow:6px 6px 0 ${props.accent}; }
    .ss-cmap .leaflet-popup-tip { background:${INK}; }
    .ss-cmap .leaflet-popup-content { margin:12px 14px; }
    .ss-cmap .leaflet-popup-close-button { color:${INK} !important; }
    .ss-cmap .leaflet-control-attribution { background:rgba(239,231,214,.8) !important;font-size:9px; }
    .ss-cpin { position:relative;width:30px;height:30px;display:grid;place-items:center; }
    .ss-cpin .ring { position:absolute;width:20px;height:20px;border-radius:50%;border:2px solid;z-index:1; }
    @keyframes cmpulse { 0%{transform:scale(.6);opacity:.7;} 100%{transform:scale(2.4);opacity:0;} }
    .ss-cpin.up .ring { animation:cmpulse 1.8s ease-out infinite; }
  `
  document.head.appendChild(styleEl)

  await new Promise(r => setTimeout(r, 60))

  map = L.map(mapEl.value, { scrollWheelZoom: false, zoomControl: true })

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
    attribution: '© OpenStreetMap © CARTO',
  }).addTo(map)

  map.setView([props.lat, props.lng], 14)

  const up = props.upcoming
  const pinHTML = up
    ? `<div class="ss-cpin up">
        <span class="ring" style="border-color:${props.accent}"></span>
        <span style="background:${props.accent};border:3px solid ${INK};width:20px;height:20px;border-radius:50%;display:block;z-index:2;position:relative;box-shadow:0 2px 5px rgba(0,0,0,.4)"></span>
      </div>`
    : `<div class="ss-cpin">
        <span style="background:${INK};border:2px solid ${PAPER};width:16px;height:16px;border-radius:50%;display:block;box-shadow:0 2px 5px rgba(0,0,0,.4)"></span>
      </div>`

  const icon = L.divIcon({ className: '', html: pinHTML, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -12] })

  L.marker([props.lat, props.lng], { icon }).addTo(map)
    .bindPopup(
      `<div style="font-family:Archivo,sans-serif;min-width:140px;">
        <div style="font:400 20px/0.95 Anton,sans-serif;text-transform:uppercase;color:${INK};">${props.city ?? ''}</div>
        <div style="font:600 13px/1.3 Archivo,sans-serif;color:#333;margin-top:4px;">${props.venueName}</div>
      </div>`
    )

  setTimeout(() => map.invalidateSize(), 300)
})

onUnmounted(() => { map?.remove() })
</script>

<template>
  <div class="ss-cmap" ref="mapEl" style="height:340px;width:100%;background:#EFE7D6;"></div>
</template>
