<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VenueMap from '@/components/map/VenueMap.vue'
import { useConcerts } from '@/composables/useConcerts'

const route  = useRoute()
const router = useRouter()
const { query } = useConcerts()

const concertId = computed(() => {
  const id = Number(route.params.id)
  return isNaN(id) ? null : id
})

const concert = computed(() =>
  query.data.value?.find(c => c.id === concertId.value) ?? null
)

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 820px; margin: 0 auto;">
    <div style="margin-bottom: 1.25rem;">
      <button @click="router.push('/concerts')">← Back to concerts</button>
    </div>

    <div v-if="query.isPending.value">Loading…</div>
    <div v-else-if="!concert" style="opacity: 0.6;">Concert not found.</div>

    <article v-else>
      <!-- Poster -->
      <img
        v-if="concert.poster_url"
        :src="concert.poster_url"
        :alt="`Concert poster — ${formatDate(concert.date)}`"
        style="width: 100%; max-height: 520px; object-fit: cover; border-radius: 8px; margin-bottom: 1.5rem; display: block;"
      />

      <!-- Header -->
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem;">
        {{ formatDate(concert.date) }}
      </h1>
      <div style="font-size: 1.05rem; opacity: 0.7; margin-bottom: 1.25rem;">
        {{ concert.venue.name }}
        <span v-if="concert.venue.city"> · {{ concert.venue.city }}</span>
      </div>

      <!-- Times -->
      <div v-if="concert.doors_open || concert.start_time" style="display: flex; gap: 1.5rem; margin-bottom: 1rem; font-size: 0.9rem;">
        <div v-if="concert.doors_open">
          <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; margin-bottom: 0.2rem;">Doors</div>
          <div>{{ concert.doors_open }}</div>
        </div>
        <div v-if="concert.start_time">
          <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; margin-bottom: 0.2rem;">Show starts</div>
          <div>{{ concert.start_time }}</div>
        </div>
      </div>

      <!-- Bands -->
      <div v-if="concert.bands.length" style="margin-bottom: 1rem;">
        <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; margin-bottom: 0.4rem;">Line-up</div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
          <span
            v-for="band in concert.bands"
            :key="band.id"
            style="font-size: 0.85rem; padding: 0.2rem 0.6rem; border: 1px solid #ddd; border-radius: 4px;"
          >{{ band.name }}<span v-if="band.play_time" style="opacity:0.5; font-size:0.8em;"> · {{ band.play_time }}</span></span>
        </div>
      </div>

      <!-- Description -->
      <p v-if="concert.description" style="line-height: 1.7; opacity: 0.8; margin-bottom: 1.25rem; white-space: pre-wrap;">
        {{ concert.description }}
      </p>

      <!-- Tags -->
      <div v-if="concert.tags?.length" style="display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 1.25rem;">
        <span
          v-for="tag in concert.tags"
          :key="tag.id"
          style="font-size: 0.78rem; padding: 0.1rem 0.45rem; border: 1px solid #ddd; border-radius: 3px; opacity: 0.65;"
        >{{ tag.name }}</span>
      </div>

      <!-- External links -->
      <div v-if="concert.links?.length" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;">
        <a
          v-for="link in concert.links"
          :key="link.id"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          style="font-size: 0.85rem; padding: 0.3rem 0.75rem; border: 1px solid #ddd; border-radius: 4px; text-decoration: none; color: inherit; transition: background 120ms;"
          onmouseover="this.style.background='#f5f5f5'"
          onmouseout="this.style.background=''"
        >{{ link.label || link.url }}</a>
      </div>

      <!-- Map -->
      <div
        v-if="concert.venue.latitude !== null && concert.venue.latitude !== undefined"
        style="border-top: 1px solid #ddd; padding-top: 1.25rem; margin-top: 0.5rem;"
      >
        <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; margin-bottom: 0.75rem;">Venue location</div>
        <VenueMap
          :latitude="concert.venue.latitude"
          :longitude="concert.venue.longitude"
          :editable="false"
        />
        <div
          v-if="concert.venue.street || concert.venue.city"
          style="font-size: 0.85rem; opacity: 0.6; margin-top: 0.5rem;"
        >
          {{ [concert.venue.street_number, concert.venue.street, concert.venue.city, concert.venue.postcode].filter(Boolean).join(', ') }}
        </div>
      </div>
    </article>
  </div>
</template>
