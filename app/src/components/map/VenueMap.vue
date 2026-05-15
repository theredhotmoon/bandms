<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { ref } from 'vue'
import type { Map as LeafletMap, Marker } from 'leaflet'

interface Props {
  latitude: number | null
  longitude: number | null
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), { editable: false })

const emit = defineEmits<{
  'update:coordinates': [lat: number, lng: number]
}>()

const mapContainer = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null
let marker: Marker | null = null

const DEFAULT_CENTER: [number, number] = [52.2297, 21.0122] // Warsaw

onMounted(async () => {
  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  // Fix bundler asset path issue for default marker icons
  const iconDefault = L.icon({
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
  L.Marker.prototype.options.icon = iconDefault

  const center: [number, number] =
    props.latitude !== null && props.longitude !== null
      ? [props.latitude, props.longitude]
      : DEFAULT_CENTER

  map = L.map(mapContainer.value!).setView(center, 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  if (props.latitude !== null && props.longitude !== null) {
    marker = L.marker([props.latitude, props.longitude]).addTo(map)
  }

  if (props.editable) {
    map.on('click', (e) => {
      const { lat, lng } = e.latlng
      if (marker) {
        marker.setLatLng([lat, lng])
      } else {
        marker = L.marker([lat, lng]).addTo(map!)
      }
      emit('update:coordinates', lat, lng)
    })
  }
})

watch(
  () => [props.latitude, props.longitude] as const,
  async ([lat, lng]) => {
    if (!map) return
    const L = await import('leaflet')
    if (lat !== null && lng !== null) {
      if (marker) {
        marker.setLatLng([lat, lng])
      } else {
        marker = L.marker([lat, lng]).addTo(map)
      }
      map.setView([lat, lng], map.getZoom())
    } else if (marker) {
      marker.remove()
      marker = null
    }
  },
)

onUnmounted(() => {
  map?.remove()
  map = null
  marker = null
})
</script>

<template>
  <div ref="mapContainer" class="venue-map" />
</template>

<style scoped>
.venue-map {
  width: 100%;
  height: 300px;
  border-radius: 4px;
}
</style>
