<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VenueMap from '@/components/map/VenueMap.vue'
import { useConcerts } from '@/composables/useConcerts'
import { useConcertSetlist } from '@/composables/useSetlists'

const route  = useRoute()
const router = useRouter()

const concertId = computed(() => {
  const id = Number(route.params.id)
  return isNaN(id) ? null : id
})

const { query }               = useConcerts()
const { query: setlistQuery } = useConcertSetlist(concertId)

const concert = computed(() =>
  query.data.value?.find(c => c.id === concertId.value) ?? null
)

const setlistItems = computed(() => {
  const items = setlistQuery.data.value?.items ?? []
  return items.map((item, idx) => ({
    ...item,
    encoreStart: item.is_encore && (idx === 0 || !items[idx - 1].is_encore),
  }))
})

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

watch(concert, (c) => {
  if (c?.date) document.title = `${formatDate(c.date)} — Skanking Storks`
}, { immediate: true })

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="concert-detail">
    <div class="detail-body">
      <button class="back-btn" @click="router.push('/concerts')">← Back to concerts</button>

      <div v-if="query.isPending.value" class="state-msg">Loading…</div>
      <div v-else-if="!concert" class="state-msg">Concert not found.</div>

      <article v-else>
        <img
          v-if="concert.poster_url"
          :src="concert.poster_url"
          :alt="`Concert poster — ${formatDate(concert.date)}`"
          class="poster"
        />

        <h1 class="concert-title">{{ formatDate(concert.date) }}</h1>
        <p class="concert-venue">
          {{ concert.venue.name }}
          <span v-if="concert.venue.city"> · {{ concert.venue.city }}</span>
        </p>

        <div v-if="concert.doors_open || concert.start_time" class="times-row">
          <div v-if="concert.doors_open" class="time-item">
            <div class="meta-label">Doors</div>
            <div>{{ concert.doors_open }}</div>
          </div>
          <div v-if="concert.start_time" class="time-item">
            <div class="meta-label">Show starts</div>
            <div>{{ concert.start_time }}</div>
          </div>
        </div>

        <div v-if="concert.bands.length" class="section-wrap">
          <div class="meta-label">Line-up</div>
          <div class="chips">
            <span v-for="band in concert.bands" :key="band.id" class="chip">
              {{ band.name }}<span v-if="band.play_time" class="chip-sub"> · {{ band.play_time }}</span>
            </span>
          </div>
        </div>

        <p v-if="concert.description" class="description">{{ concert.description }}</p>

        <div v-if="concert.tags?.length" class="chips chips--spaced">
          <span v-for="tag in concert.tags" :key="tag.id" class="chip chip--tag">{{ tag.name }}</span>
        </div>

        <div v-if="concert.links?.length" class="links-row">
          <a
            v-for="link in concert.links"
            :key="link.id"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="ext-link"
          >{{ link.label || link.url }}</a>
        </div>

        <!-- Map -->
        <div
          v-if="concert.venue.latitude !== null && concert.venue.latitude !== undefined"
          class="divider-section"
        >
          <div class="meta-label">Venue location</div>
          <VenueMap
            :latitude="concert.venue.latitude"
            :longitude="concert.venue.longitude"
            :editable="false"
            :grayscale="true"
          />
          <p v-if="concert.venue.street || concert.venue.city" class="venue-address">
            {{ [concert.venue.street_number, concert.venue.street, concert.venue.city, concert.venue.postcode].filter(Boolean).join(', ') }}
          </p>
        </div>

        <!-- Setlist -->
        <div v-if="setlistQuery.data.value" class="divider-section">
          <div class="setlist-head">
            <div class="meta-label">Setlist</div>
            <span v-if="setlistQuery.data.value.total_duration_sec" class="setlist-total">
              {{ formatDuration(setlistQuery.data.value.total_duration_sec) }}
            </span>
          </div>
          <ol class="setlist-list">
            <template v-for="item in setlistItems" :key="item.id">
              <li v-if="item.encoreStart" class="encore-sep" aria-hidden="true">— Encore —</li>
              <li class="sl-item" :class="{ 'sl-item--encore': item.is_encore }">
                <span class="sl-pos">{{ item.position }}</span>
                <span class="sl-title">{{ item.song?.title ?? 'Unknown' }}</span>
                <span
                  v-if="item.override_duration_sec ?? item.song?.duration_sec"
                  class="sl-dur"
                >{{ formatDuration(item.override_duration_sec ?? item.song?.duration_sec ?? 0) }}</span>
              </li>
            </template>
          </ol>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.concert-detail {
  min-height: calc(100vh - 56px);
  background: #fff;
  color: #111;
}

.detail-body {
  max-width: 820px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.back-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1.75rem;
  transition: color 120ms;
}
.back-btn:hover { color: #111; }

.state-msg { opacity: 0.55; }

.poster {
  width: 100%;
  max-height: 520px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  display: block;
}

.concert-title {
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: 0.3rem;
}

.concert-venue {
  font-size: 1.05rem;
  color: #666;
  margin-bottom: 1.5rem;
}

.meta-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #999;
  margin-bottom: 0.45rem;
}

.times-row {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.section-wrap { margin-bottom: 1.5rem; }

.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chips--spaced { margin-bottom: 1.25rem; }

.chip {
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  color: #333;
}
.chip--tag { font-size: 0.78rem; color: #888; }
.chip-sub  { opacity: 0.55; font-size: 0.8em; }

.description {
  line-height: 1.75;
  color: #555;
  margin-bottom: 1.25rem;
  white-space: pre-wrap;
}

.links-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}
.ext-link {
  font-size: 0.85rem;
  padding: 0.3rem 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  text-decoration: none;
  color: inherit;
  transition: background 120ms;
}
.ext-link:hover { background: #f5f5f5; }

/* ── Shared section separator ── */
.divider-section {
  border-top: 1px solid #eee;
  padding-top: 1.5rem;
  margin-top: 1.5rem;
}

.venue-address {
  font-size: 0.85rem;
  color: #999;
  margin-top: 0.5rem;
}

/* ── Setlist ── */
.setlist-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.875rem;
}
.setlist-total {
  font-size: 0.75rem;
  color: #bbb;
  font-variant-numeric: tabular-nums;
}

.setlist-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

.encore-sep {
  list-style: none;
  text-align: center;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #bbb;
  padding: 0.45rem 0;
  background: #fafafa;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
}

.sl-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.625rem 1rem;
  font-size: 0.9rem;
  border-bottom: 1px solid #f0f0f0;
}
.sl-item:last-child { border-bottom: none; }
.sl-item--encore .sl-title { color: #888; }

.sl-pos {
  font-size: 0.75rem;
  color: #ccc;
  min-width: 1.5rem;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.sl-title { flex: 1; }
.sl-dur {
  font-size: 0.75rem;
  color: #bbb;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
</style>
