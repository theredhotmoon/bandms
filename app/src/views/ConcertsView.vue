<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useConcerts } from '@/composables/useConcerts'
import { useLang } from '@/composables/useLang'
import SiteNav from '@/components/public/SiteNav.vue'
import SiteFooter from '@/components/public/SiteFooter.vue'
import CheckerStrip from '@/components/public/CheckerStrip.vue'

const { lang } = useLang()
const { query } = useConcerts()

const today = new Date()
today.setHours(0, 0, 0, 0)

const all = computed(() => query.data.value ?? [])

const upcoming = computed(() =>
  all.value
    .filter(c => new Date(c.date + 'T00:00:00') >= today)
    .sort((a, b) => a.date.localeCompare(b.date)),
)

const past = computed(() =>
  all.value
    .filter(c => new Date(c.date + 'T00:00:00') < today)
    .sort((a, b) => b.date.localeCompare(a.date)),
)

// Unique years from past concerts
const years = computed(() => {
  const ys = new Set(past.value.map(c => c.date.slice(0, 4)))
  return [...ys].sort((a, b) => b.localeCompare(a))
})
const selectedYear = ref<string | null>(null)

const filteredPast = computed(() => {
  if (!selectedYear.value) return past.value
  return past.value.filter(c => c.date.startsWith(selectedYear.value!))
})

// Stats
const uniqueCities = computed(() => new Set(all.value.map(c => c.venue.city).filter(Boolean)).size)

// Map
let map: any = null
const mapEl = ref<HTMLElement | null>(null)
const mapLoaded = ref(false)

onMounted(async () => {
  if (!mapEl.value) return
  try {
    const L = (await import('leaflet')).default
    await import('leaflet/dist/leaflet.css')
    map = L.map(mapEl.value, { zoomControl: true, scrollWheelZoom: false })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map)

    const upcomingIcon = L.divIcon({
      className: '',
      html: '<div class="ss-pin-wrap"><span class="ss-ring"></span><span class="ss-dot ss-dot--upcoming"></span></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    })

    const pastIcon = L.divIcon({
      className: '',
      html: '<span class="ss-dot ss-dot--past"></span>',
      iconSize: [13, 13],
      iconAnchor: [6, 6],
    })

    const concertsWithCoords = all.value.filter(
      c => c.venue.latitude && c.venue.longitude,
    )

    if (concertsWithCoords.length) {
      const bounds: [number, number][] = []
      concertsWithCoords.forEach(c => {
        const lat = parseFloat(String(c.venue.latitude!))
        const lng = parseFloat(String(c.venue.longitude!))
        if (isNaN(lat) || isNaN(lng)) return
        bounds.push([lat, lng])
        const isUpcoming = new Date(c.date + 'T00:00:00') >= today
        const icon = isUpcoming ? upcomingIcon : pastIcon
        const badge = isUpcoming
          ? `<div style="display:inline-block;background:var(--color-accent);color:#fff;font:800 10px/1 Archivo,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;margin-bottom:8px;">${lang.value === 'pl' ? 'NADCHODZĄCY' : 'UPCOMING'}</div>`
          : ''
        L.marker([lat, lng], { icon })
          .addTo(map!)
          .bindPopup(
            `<div style="font-family:Anton,sans-serif;color:#121212;min-width:150px;">${badge}<div style="font:400 20px/1.1 Anton,sans-serif;text-transform:uppercase;">${c.venue.name}</div><div style="font:600 13px/1 Archivo,sans-serif;color:#666;margin-top:5px;">${c.venue.city ?? ''}</div><div style="font:800 11px/1 Archivo,sans-serif;color:#888;margin-top:5px;letter-spacing:.08em;">${c.date}</div></div>`,
          )
      })
      if (bounds.length === 1) {
        map.setView(bounds[0], 10)
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    } else {
      map.setView([52.2297, 21.0122], 5)
    }
    mapLoaded.value = true
  } catch (_) { /* map optional */ }
})

onUnmounted(() => {
  map?.remove()
  map = null
})

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function dayNum(date: string): string {
  return new Date(date + 'T00:00:00').getDate().toString()
}
function monthShort(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
}

const T = {
  en: {
    heroTitle: 'Live Shows',
    heroSub: 'Ska-fuelled shows across Poland and beyond — check dates, get tickets, book us.',
    upcoming: 'Upcoming',
    played: 'Played',
    cities: 'Cities',
    upcomingShows: 'Upcoming Shows',
    archive: 'Show Archive',
    all: 'All',
    tickets: 'Tickets',
    tba: 'TBA',
    noUpcoming: 'No upcoming dates yet — check back soon.',
    noPast: 'No past shows in this year.',
    book: 'Book a show',
    withBands: 'With:',
  },
  pl: {
    heroTitle: 'Koncerty',
    heroSub: 'Skankujemy po całej Polsce i dalej — sprawdź daty, kup bilet, zarezerwuj nas.',
    upcoming: 'Nadchodzące',
    played: 'Zagranych',
    cities: 'Miast',
    upcomingShows: 'Nadchodzące koncerty',
    archive: 'Archiwum koncertów',
    all: 'Wszystkie',
    tickets: 'Bilety',
    tba: 'TBA',
    noUpcoming: 'Daty wkrótce — zajrzyj ponownie.',
    noPast: 'Brak koncertów w tym roku.',
    book: 'Zarezerwuj koncert',
    withBands: 'Razem z:',
  },
}
const t = computed(() => T[lang.value])
</script>

<template>
  <div class="concerts-page">
    <SiteNav active="shows" />
    <main>
    <!-- HERO -->
    <section class="hero">
      <div class="hero-checker" />
      <div class="hero-inner">
        <div class="hero-text">
          <span class="hero-kicker">{{ t.upcoming.toUpperCase() }} · LIVE</span>
          <h1 class="hero-title">{{ t.heroTitle }}</h1>
          <p class="hero-sub">{{ t.heroSub }}</p>
          <RouterLink to="/contact" class="solid-btn">{{ t.book }}</RouterLink>
        </div>
        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-num">{{ upcoming.length }}</div>
            <div class="stat-label">{{ t.upcoming }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">{{ past.length }}</div>
            <div class="stat-label">{{ t.played }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">{{ uniqueCities }}</div>
            <div class="stat-label">{{ t.cities }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- MAP -->
    <div class="map-wrap">
      <div ref="mapEl" class="map-el" />
      <div v-if="!mapLoaded" class="map-placeholder">
        <span class="map-placeholder-text">{{ lang === 'en' ? 'Loading map…' : 'Ładowanie mapy…' }}</span>
      </div>
      <div v-if="mapLoaded" class="map-legend">
        <div class="map-legend-item">
          <span class="ss-dot ss-dot--upcoming map-legend-dot" />
          <span>{{ t.upcoming }}</span>
        </div>
        <div class="map-legend-item">
          <span class="ss-dot ss-dot--past map-legend-dot" />
          <span>{{ lang === 'en' ? 'Past' : 'Minione' }}</span>
        </div>
      </div>
    </div>

    <!-- UPCOMING CONCERTS -->
    <section class="concerts-section">
      <div class="section-inner">
        <h2 class="section-head">{{ t.upcomingShows }}</h2>
        <CheckerStrip :h="12" :size="22" color-a="var(--color-accent)" color-b="#EFE7D6" style="margin: 20px 0;" />

        <div v-if="upcoming.length" class="concert-list">
          <div v-for="c in upcoming" :key="c.id" class="concert-row">
            <div class="date-block">
              <span class="date-day">{{ dayNum(c.date) }}</span>
              <span class="date-month">{{ monthShort(c.date) }}</span>
            </div>
            <div class="concert-info">
              <div class="concert-venue">{{ c.venue.name }}</div>
              <div class="concert-city">{{ c.venue.city }}</div>
              <div v-if="c.bands?.length > 1" class="concert-bands">
                {{ t.withBands }} {{ c.bands.filter(b => b.name !== 'Skanking Storks').map(b => b.name).join(', ') }}
              </div>
            </div>
            <div class="concert-actions">
              <a v-if="c.links?.length" :href="c.links[0].url" target="_blank" rel="noopener" class="ticket-btn">
                {{ t.tickets }} →
              </a>
              <span v-else class="tba-stamp">{{ t.tba }}</span>
            </div>
          </div>
        </div>
        <p v-else class="empty-text">{{ t.noUpcoming }}</p>
      </div>
    </section>

    <!-- ARCHIVE -->
    <section class="archive-section">
      <CheckerStrip :h="14" :size="28" color-a="#121212" color-b="#EFE7D6" />
      <div class="archive-inner">
        <h2 class="section-head section-head--cream">{{ t.archive }}</h2>

        <!-- Year filter -->
        <div v-if="years.length" class="year-filters">
          <button
            class="year-btn"
            :class="{ 'year-btn--active': selectedYear === null }"
            @click="selectedYear = null"
          >{{ t.all }}</button>
          <button
            v-for="y in years"
            :key="y"
            class="year-btn"
            :class="{ 'year-btn--active': selectedYear === y }"
            @click="selectedYear = y"
          >{{ y }}</button>
        </div>

        <div v-if="filteredPast.length" class="archive-list">
          <div v-for="c in filteredPast" :key="c.id" class="archive-row">
            <span class="archive-date">{{ formatDate(c.date) }}</span>
            <span class="archive-sep">·</span>
            <span class="archive-venue">{{ c.venue.name }}, {{ c.venue.city }}</span>
          </div>
        </div>
        <p v-else class="empty-text empty-text--cream">{{ t.noPast }}</p>
      </div>
      <CheckerStrip :h="14" :size="18" color-a="var(--color-accent)" color-b="#121212" />
    </section>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.concerts-page { background: #EFE7D6; color: #121212; font-family: 'Archivo', sans-serif; }

/* HERO */
.hero { background: #121212; color: #EFE7D6; position: relative; overflow: hidden; }
.hero-checker {
  position: absolute; inset: 0;
  background-image: repeating-conic-gradient(rgba(255,255,255,.04) 0% 25%, transparent 0% 50%);
  background-size: 36px 36px;
}
.hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 48px;
  padding: 64px 90px;
  flex-wrap: wrap;
}
.hero-kicker {
  font: 800 13px/1 'Archivo', sans-serif;
  letter-spacing: .28em;
  color: var(--color-accent);
  text-transform: uppercase;
  display: block;
  margin-bottom: 16px;
}
.hero-title { font: 400 80px/.85 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 20px; }
.hero-sub { font: 500 18px/1.5 'Archivo', sans-serif; color: rgba(239,231,214,.75); max-width: 480px; margin: 0 0 28px; }
.solid-btn {
  display: inline-flex; align-items: center; gap: 10px;
  background: var(--color-accent); color: #fff; text-decoration: none;
  font: 400 16px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 14px 22px; box-shadow: 5px 5px 0 #EFE7D6;
  transition: opacity 150ms;
}
.solid-btn:hover { opacity: .9; }

.stats-row { display: flex; gap: 0; flex-shrink: 0; }
.stat-box {
  background: transparent;
  border: 3px solid rgba(239,231,214,.3);
  padding: 28px 36px;
  text-align: center;
  min-width: 110px;
}
.stat-box + .stat-box { border-left: none; }
.stat-num { font: 400 52px/.9 'Anton', sans-serif; color: var(--color-accent); }
.stat-label { font: 700 13px/1 'Archivo', sans-serif; letter-spacing: .12em; text-transform: uppercase; color: rgba(239,231,214,.6); margin-top: 8px; }

/* MAP */
.map-wrap { position: relative; height: 420px; border-bottom: 4px solid #121212; }
.map-el { width: 100%; height: 100%; }
.map-placeholder {
  position: absolute; inset: 0;
  background: repeating-conic-gradient(#d6cebd 0% 25%, #c8c0b0 0% 50%) 0 0/28px 28px;
  display: grid; place-items: center;
}
.map-placeholder-text { font: 700 16px/1 'Archivo', sans-serif; color: #888; }
.map-legend {
  position: absolute; bottom: 12px; left: 12px; z-index: 500;
  background: #EFE7D6; border: 3px solid #121212;
  box-shadow: 4px 4px 0 #121212;
  padding: 10px 14px; display: flex; flex-direction: column; gap: 7px;
}
.map-legend-item {
  display: flex; align-items: center; gap: 9px;
  font: 700 12px/1 'Archivo', sans-serif; letter-spacing: .08em;
  text-transform: uppercase; color: #121212;
}
.map-legend-dot { display: block; flex-shrink: 0; }

/* CONCERTS SECTION */
.concerts-section { padding: 56px 90px; }
.section-inner {}
.section-head { font: 400 56px/.86 'Anton', sans-serif; text-transform: uppercase; margin: 0; }
.section-head--cream { color: #EFE7D6; }

.concert-list { border-top: 3px solid #121212; margin-top: 8px; }
.concert-row {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  align-items: center;
  gap: 28px;
  padding: 20px 4px;
  border-bottom: 3px solid #121212;
}
.date-block {
  display: flex; flex-direction: column; align-items: center;
  background: var(--color-accent); color: #fff;
  padding: 12px 10px 8px;
  box-shadow: 4px 4px 0 #121212;
  min-width: 72px;
}
.date-day { font: 400 42px/.9 'Anton', sans-serif; }
.date-month { font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .14em; text-transform: uppercase; margin-top: 4px; }
.concert-venue { font: 400 30px/.95 'Anton', sans-serif; text-transform: uppercase; }
.concert-city { font: 600 15px/1 'Archivo', sans-serif; color: #666; margin-top: 5px; }
.concert-bands { font: 600 13px/1 'Archivo', sans-serif; color: var(--color-accent); margin-top: 5px; }
.concert-actions {}
.ticket-btn {
  display: inline-block; background: var(--color-accent); color: #fff;
  font: 400 15px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 14px 18px; text-decoration: none;
  box-shadow: 4px 4px 0 #121212; white-space: nowrap;
  transition: opacity 150ms;
}
.ticket-btn:hover { opacity: .9; }
.tba-stamp {
  display: inline-block; border: 3px solid #121212; color: #121212;
  font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .14em;
  text-transform: uppercase; padding: 8px 12px; border-radius: 3px;
  transform: rotate(2deg); white-space: nowrap;
}
.empty-text { font: 500 16px/1.5 'Archivo', sans-serif; color: #777; padding: 24px 0; }
.empty-text--cream { color: rgba(239,231,214,.5); }

/* ARCHIVE */
.archive-section { background: #121212; color: #EFE7D6; }
.archive-inner { padding: 56px 90px; }
.year-filters { display: flex; gap: 10px; flex-wrap: wrap; margin: 22px 0 28px; }
.year-btn {
  border: 3px solid rgba(239,231,214,.3); background: transparent;
  color: rgba(239,231,214,.7); font: 400 17px/1 'Anton', sans-serif;
  text-transform: uppercase; padding: 11px 18px; cursor: pointer;
  transition: all 150ms;
}
.year-btn:hover, .year-btn--active {
  background: var(--color-accent); border-color: var(--color-accent); color: #fff;
  box-shadow: 4px 4px 0 rgba(239,231,214,.2);
}
.archive-list {}
.archive-row {
  display: flex; gap: 16px; align-items: center;
  padding: 13px 0; border-bottom: 1px solid rgba(239,231,214,.12);
  font: 600 15px/1 'Archivo', sans-serif;
}
.archive-date { color: rgba(239,231,214,.5); min-width: 160px; flex-shrink: 0; }
.archive-sep { color: var(--color-accent); flex-shrink: 0; }
.archive-venue { color: rgba(239,231,214,.85); }

@media (max-width: 1100px) {
  .hero-inner { padding: 48px 40px; }
  .concerts-section { padding: 40px 40px; }
  .archive-inner { padding: 40px 40px; }
}
@media (max-width: 768px) {
  .hero-inner { grid-template-columns: 1fr; padding: 36px 20px; }
  .stats-row { flex-wrap: wrap; }
  .concert-row { grid-template-columns: 72px 1fr; }
  .concert-actions { grid-column: 1 / -1; padding-left: 100px; }
  .concerts-section { padding: 32px 20px; }
  .archive-inner { padding: 32px 20px; }
  .archive-date { min-width: auto; }
}
</style>

<!-- Non-scoped: Leaflet pin classes and popup overrides live outside Vue's scope -->
<style>
@keyframes ss-pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(2); opacity: 0; }
}
.ss-pin-wrap {
  position: relative;
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
}
.ss-ring {
  position: absolute;
  inset: -5px;
  border: 3px solid var(--color-accent);
  border-radius: 50%;
  animation: ss-pulse 2s ease-out infinite;
  pointer-events: none;
}
.ss-dot { display: block; border-radius: 50%; flex-shrink: 0; }
.ss-dot--upcoming {
  width: 20px; height: 20px;
  background: var(--color-accent);
  border: 3px solid #121212;
  box-shadow: 3px 3px 0 rgba(18,18,18,.35);
  position: relative; z-index: 1;
}
.ss-dot--past {
  width: 13px; height: 13px;
  background: #121212;
  border: 2px solid #EFE7D6;
  opacity: 0.88;
}

/* Leaflet popup branding */
.leaflet-popup-content-wrapper {
  border-radius: 0 !important;
  border: 3px solid #121212 !important;
  box-shadow: 5px 5px 0 #121212 !important;
  background: #EFE7D6 !important;
  padding: 0 !important;
}
.leaflet-popup-content {
  margin: 12px 16px !important;
}
.leaflet-popup-tip { background: #EFE7D6 !important; }
.leaflet-popup-close-button {
  color: #121212 !important;
  font: 800 16px/1 Archivo, sans-serif !important;
  top: 6px !important; right: 6px !important;
  width: 22px !important; height: 22px !important;
  line-height: 20px !important; text-align: center !important;
}
.leaflet-popup-close-button:hover { color: var(--color-accent) !important; }

/* Leaflet zoom control branding */
.leaflet-control-zoom a {
  background: #EFE7D6 !important;
  color: #121212 !important;
  border-color: #121212 !important;
  border-radius: 0 !important;
  font: 400 18px/30px 'Anton', sans-serif !important;
  width: 30px !important; height: 30px !important;
}
.leaflet-control-zoom a:hover {
  background: #121212 !important;
  color: #EFE7D6 !important;
}
.leaflet-control-zoom {
  border: 3px solid #121212 !important;
  border-radius: 0 !important;
  box-shadow: 3px 3px 0 #121212 !important;
}
.leaflet-control-attribution {
  background: rgba(239,231,214,.9) !important;
  color: #666 !important;
  font: 600 10px/1 Archivo, sans-serif !important;
}
</style>
