<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useConcerts } from '@/composables/useConcerts'
import AllVenuesMapModal from '@/components/map/AllVenuesMapModal.vue'
import type { Concert } from '@/types/concert'

const router = useRouter()
const { query } = useConcerts()
const allConcerts = computed<Concert[]>(() => query.data.value ?? [])

const today = new Date()
today.setHours(0, 0, 0, 0)

type Filter = 'all' | 'upcoming' | 'past'
const filter = ref<Filter>('all')

const concerts = computed(() => {
  return allConcerts.value.filter(c => {
    const d = new Date(c.date + 'T00:00:00')
    if (filter.value === 'upcoming') return d >= today
    if (filter.value === 'past')     return d < today
    return true
  })
})

const stats = computed(() => {
  const past     = allConcerts.value.filter(c => new Date(c.date + 'T00:00:00') < today).length
  const upcoming = allConcerts.value.filter(c => new Date(c.date + 'T00:00:00') >= today).length
  const venues   = new Set(allConcerts.value.map(c => c.venue.id)).size
  return { past, upcoming, venues }
})

const showVenuesMap = ref(false)
const concertsWithCoords = computed(() =>
  allConcerts.value.filter(c => c.venue.latitude != null && c.venue.longitude != null)
)

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatMonth(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
}

function formatDay(date: string) {
  return new Date(date + 'T00:00:00').getDate()
}
</script>

<template>
  <div class="concerts-page">
    <header class="page-header">
      <div class="page-header-inner">
        <p class="page-eyebrow">Live</p>
        <h1 class="page-title">Concert Schedule</h1>
        <p class="page-sub">Upcoming shows and past gigs.</p>
      </div>
    </header>

    <div class="concerts-body">

    <!-- Stats -->
    <div v-if="!query.isPending.value && allConcerts.length" class="stats-row">
      <div class="stat-pill">
        <span class="stat-value">{{ stats.past }}</span>
        <span class="stat-label">{{ stats.past === 1 ? 'gig played' : 'gigs played' }}</span>
      </div>
      <div class="stat-divider" />
      <div class="stat-pill">
        <span class="stat-value">{{ stats.upcoming }}</span>
        <span class="stat-label">{{ stats.upcoming === 1 ? 'show planned' : 'shows planned' }}</span>
      </div>
      <div class="stat-divider" />
      <div class="stat-pill">
        <span class="stat-value">{{ stats.venues }}</span>
        <span class="stat-label">{{ stats.venues === 1 ? 'venue' : 'venues' }}</span>
      </div>
    </div>

    <!-- Filter tabs + map button -->
    <div v-if="!query.isPending.value && allConcerts.length" class="toolbar-row">
      <div class="filter-row">
      <button
        v-for="opt in ([
          { key: 'all',      label: 'All' },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'past',     label: 'Past shows' },
        ] as const)"
        :key="opt.key"
        class="filter-btn"
        :class="{ 'filter-btn--active': filter === opt.key }"
        @click="filter = opt.key"
      >{{ opt.label }}</button>
      </div><!-- filter-row -->
      <button
        v-if="concertsWithCoords.length"
        class="map-btn"
        @click="showVenuesMap = true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/>
          <line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
        Show where we played
      </button>
    </div><!-- toolbar-row -->

    <div v-if="query.isPending.value">Loading concerts…</div>
    <div v-else-if="query.isError.value">Failed to load concerts.</div>
    <div v-else-if="!allConcerts.length" style="opacity: 0.6;">No concerts scheduled yet.</div>
    <div v-else-if="!concerts.length" style="opacity: 0.6; margin-top: 1rem;">
      No {{ filter === 'upcoming' ? 'upcoming concerts' : 'past shows' }} to display.
    </div>

    <div v-else class="concerts-grid">
      <div
        v-for="concert in concerts"
        :key="concert.id"
        class="concert-card"
        :class="{ 'concert-card--past': new Date(concert.date + 'T00:00:00') < today }"
      >
        <!-- Poster / placeholder -->
        <div class="concert-poster" @click="router.push(`/concerts/${concert.id}`)">
          <img
            v-if="concert.poster_url"
            :src="concert.poster_url"
            :alt="`Poster for ${formatDate(concert.date)}`"
            class="concert-poster-img"
          />
          <div v-else class="concert-poster-placeholder">
            <span class="placeholder-day">{{ formatDay(concert.date) }}</span>
            <span class="placeholder-month">{{ formatMonth(concert.date) }}</span>
          </div>
        </div>

        <!-- Info -->
        <div class="concert-info">
          <div class="concert-date">{{ formatDate(concert.date) }}</div>
          <div class="concert-venue">
            {{ concert.venue.name }}
            <span v-if="concert.venue.city" class="concert-city"> · {{ concert.venue.city }}</span>
          </div>
          <div v-if="concert.doors_open || concert.start_time" class="concert-times">
            <span v-if="concert.doors_open">Doors {{ concert.doors_open }}</span>
            <span v-if="concert.doors_open && concert.start_time"> · </span>
            <span v-if="concert.start_time">Show {{ concert.start_time }}</span>
          </div>
          <div v-if="concert.bands.length" class="concert-bands">
            With: {{ concert.bands.map(b => b.name).join(', ') }}
          </div>
          <button class="concert-details-btn" @click="router.push(`/concerts/${concert.id}`)">
            Show details →
          </button>
        </div>
      </div>
    </div><!-- concerts-grid -->
    </div><!-- concerts-body -->
  </div><!-- concerts-page -->

  <AllVenuesMapModal
    v-if="showVenuesMap"
    :concerts="concertsWithCoords"
    @close="showVenuesMap = false"
  />
</template>

<style scoped>
/* ── Header ─────────────────────────────────────────────── */
.page-header { padding: 4rem 1.5rem 3rem; background: #fff; border-bottom: 1px solid #e0e0e0; }
.page-header-inner { max-width: 960px; margin: 0 auto; }
.page-eyebrow {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #888; margin-bottom: 0.75rem;
}
.page-title {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700; color: #111; line-height: 1.2; margin-bottom: 0.5rem;
}
.page-sub { font-size: 1rem; color: #888; }

.concerts-body { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }

/* ── Toolbar (filters + map button) ──────────────────────── */
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.filter-row { display: flex; gap: 0.25rem; flex-wrap: wrap; }

.map-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: #fff; color: #111;
  border: 1px solid #ccc; cursor: pointer;
  transition: background 120ms, border-color 120ms;
}
.map-btn:hover { background: #f5f5f5; border-color: #999; }

/* ── Stats ──────────────────────────────────────────────── */
.stats-row {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 1.125rem;
  background: #f9f9f9;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  padding: 0 0.875rem;
}
.stat-pill:first-child { padding-left: 0; }
.stat-pill:last-child  { padding-right: 0; }

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #111;
  line-height: 1;
}

.stat-label {
  font-size: 0.8rem;
  color: #888;
  font-weight: 400;
}

.stat-divider {
  width: 1px;
  height: 2rem;
  background: #e0e0e0;
  flex-shrink: 0;
}

/* ── Filter tabs ────────────────────────────────────────── */
.filter-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  background: transparent;
  border: 1px solid #e0e0e0;
  color: #666;
  cursor: pointer;
  transition: background 100ms, color 100ms, border-color 100ms;
}
.filter-btn:hover       { background: #f5f5f5; color: #111; }
.filter-btn--active     { background: #111; color: #fff; border-color: #111; }

/* ── Grid ───────────────────────────────────────────────── */
.concerts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

.concert-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 150ms;
}
.concert-card:hover             { border-color: #aaa; }
.concert-card--past             { opacity: 0.7; }
.concert-card--past:hover       { opacity: 1; }

/* Poster */
.concert-poster {
  aspect-ratio: 3 / 4;
  overflow: hidden;
  cursor: pointer;
  background: #f5f5f5;
}
.concert-poster-img {
  width: 100%; height: 100%; object-fit: cover;
  display: block;
  transition: transform 300ms;
}
.concert-card:hover .concert-poster-img { transform: scale(1.03); }

.concert-poster-placeholder {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: #111; color: #fff;
  gap: 0.25rem;
}
.placeholder-day   { font-size: 3.5rem; font-weight: 700; line-height: 1; }
.placeholder-month { font-size: 1rem; font-weight: 600; letter-spacing: 0.12em; opacity: 0.6; }

/* Info */
.concert-info {
  padding: 0.875rem 1rem 1rem;
  display: flex; flex-direction: column; gap: 0.25rem;
  flex: 1;
}
.concert-date   { font-weight: 700; font-size: 0.9rem; }
.concert-venue  { font-size: 0.85rem; }
.concert-city   { opacity: 0.55; }
.concert-times  { font-size: 0.8rem; opacity: 0.6; }
.concert-bands  { font-size: 0.8rem; opacity: 0.65; }

.concert-details-btn {
  margin-top: auto;
  padding-top: 0.625rem;
  align-self: flex-start;
  background: none; border: none; padding: 0;
  font-size: 0.82rem; font-weight: 600; cursor: pointer;
  color: #111; text-decoration: underline; text-underline-offset: 3px;
  transition: opacity 120ms;
}
.concert-details-btn:hover { opacity: 0.55; }

@media (max-width: 480px) {
  .stats-row    { gap: 0.5rem; }
  .stat-divider { display: none; }
  .stat-pill    { padding: 0.25rem 0; flex-basis: calc(33% - 0.5rem); }
}
</style>
