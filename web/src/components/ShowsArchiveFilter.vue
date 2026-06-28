<script setup lang="ts">
import { ref, computed } from 'vue'

interface ArchivedConcert {
  id: number
  slug: string
  date: string
  day: string
  mo: string
  yr: string
  city: string
  venue: string
  type: string
  hasCoords: boolean
}

const props = defineProps<{
  concerts: ArchivedConcert[]
  accent: string
}>()

const selectedYear = ref('all')

const years = computed(() => {
  const ys = [...new Set(props.concerts.map(c => c.yr))].sort((a, b) => Number(b) - Number(a))
  return ['all', ...ys]
})

const shown = computed(() =>
  selectedYear.value === 'all'
    ? props.concerts
    : props.concerts.filter(c => c.yr === selectedYear.value)
)

function showOnMap(id: number) {
  const mapSection = document.getElementById('shows-map')
  mapSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('ss:fly-to', { detail: { id } }))
  }, 700)
}
</script>

<template>
  <div class="archive-wrap">
    <!-- Header row -->
    <div class="archive-head-row">
      <div class="archive-head-left">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="0.8" :fill="accent" stroke="none"/>
        </svg>
        <h2 class="archive-title">Played shows</h2>
      </div>
      <div class="year-filters">
        <button
          v-for="y in years"
          :key="y"
          class="year-btn"
          :class="{ active: selectedYear === y }"
          @click="selectedYear = y"
        >{{ y === 'all' ? 'All' : y }}</button>
      </div>
    </div>
    <p class="archive-sub">The road so far — browse the back catalogue of gigs.</p>

    <div class="archive-list">
      <div v-for="c in shown" :key="c.id" class="archive-row">
        <a :href="`/concerts/${c.slug}`" class="arc-date-block">
          <span class="arc-day">{{ c.day }}</span>
          <span class="arc-mo">{{ c.mo }} {{ c.yr }}</span>
        </a>
        <a :href="`/concerts/${c.slug}`" class="arc-main">
          <span class="arc-city">{{ c.city }}</span>
          <span class="arc-venue">{{ c.venue }}</span>
        </a>
        <span v-if="c.type" class="arc-type">{{ c.type }}</span>
        <button
          v-if="c.hasCoords"
          class="arc-map-btn"
          :aria-label="`Show ${c.city} on map`"
          type="button"
          @click="showOnMap(c.id)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="none" aria-hidden="true">
            <path d="M12 3.5l1.2 5.3 5.3 1.2-5.3 1.2L12 16.5l-1.2-5.3L5.5 10l5.3-1.2z" :fill="accent"/>
          </svg>
          Show on map
        </button>
        <div v-else />
      </div>
    </div>

    <div v-if="shown.length === 0" class="archive-empty">No shows for this year.</div>
  </div>
</template>

<style scoped>
.archive-wrap {
  padding: 56px 90px 52px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
.archive-head-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.archive-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.archive-title {
  font-family: 'Anton', sans-serif;
  font-size: clamp(36px, 5vw, 56px);
  line-height: .96;
  letter-spacing: .01em;
  text-transform: uppercase;
  margin: 0;
  color: #121212;
}
.year-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.year-btn {
  background: transparent;
  color: #121212;
  border: 3px solid #121212;
  font-family: 'Anton', sans-serif;
  font-size: 16px;
  letter-spacing: .01em;
  text-transform: uppercase;
  padding: 9px 15px;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.year-btn.active,
.year-btn:hover {
  background: #121212;
  color: #EFE7D6;
}
.archive-sub {
  font: 500 17px/1.5 'Archivo', sans-serif;
  color: #444;
  margin: 14px 0 26px;
}
.archive-list {
  border-top: 3px solid rgba(18,18,18,.2);
}
.archive-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 22px;
  padding: 15px 4px;
  border-bottom: 2px solid rgba(18,18,18,.14);
}
.arc-date-block {
  text-align: center;
  min-width: 72px;
  text-decoration: none;
  color: inherit;
  display: block;
}
.arc-day {
  display: block;
  font-family: 'Anton', sans-serif;
  font-size: 36px;
  line-height: .86;
  letter-spacing: .01em;
  color: #121212;
}
.arc-mo {
  display: block;
  font: 800 11px/1.2 'Archivo', sans-serif;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #777;
  margin-top: 4px;
}
.arc-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-decoration: none;
  color: inherit;
}
.arc-city {
  font-family: 'Anton', sans-serif;
  font-size: 26px;
  line-height: .95;
  letter-spacing: .01em;
  text-transform: uppercase;
  color: #2a2a2a;
}
.arc-venue {
  font: 600 14px/1 'Archivo', sans-serif;
  color: #777;
}
.arc-type {
  font: 800 10px/1 'Archivo', sans-serif;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: #888;
  border: 2px solid #bbb;
  padding: 4px 7px;
  white-space: nowrap;
}
.arc-map-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: none;
  cursor: pointer;
  font: 700 12px/1 'Archivo', sans-serif;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: v-bind(accent);
  white-space: nowrap;
  padding: 0;
}
.arc-map-btn:hover { opacity: .75; }
.archive-empty {
  padding: 32px;
  text-align: center;
  font: 500 16px/1.5 'Archivo', sans-serif;
  color: #777;
}

@media (max-width: 768px) {
  .archive-wrap { padding: 40px 24px; }
  .archive-head-row { align-items: flex-start; flex-direction: column; }
  .archive-row { grid-template-columns: auto 1fr; }
  .arc-type, .arc-map-btn { display: none; }
}
</style>
