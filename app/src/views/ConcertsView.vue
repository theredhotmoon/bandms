<script setup lang="ts">
import { computed, ref } from 'vue'
import VenueMap from '@/components/map/VenueMap.vue'
import { useConcerts } from '@/composables/useConcerts'
import { useVenues } from '@/composables/useVenues'
import type { Concert } from '@/types/concert'
import type { Venue } from '@/types/venue'

const { query, create, update, remove } = useConcerts()
const { query: venuesQuery } = useVenues()

const editing = ref<Concert | null>(null)
const showForm = ref(false)

const form = ref({
  venue_id:    0,
  date:        '',
  start_time:  '',
  description: '',
})

function openCreate() {
  editing.value = null
  form.value = { venue_id: 0, date: '', start_time: '', description: '' }
  showForm.value = true
}

function openEdit(concert: Concert) {
  editing.value = concert
  form.value = {
    venue_id:    concert.venue.id,
    date:        concert.date,
    start_time:  concert.start_time ?? '',
    description: concert.description ?? '',
  }
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editing.value = null
}

async function submitForm() {
  const payload = {
    venue_id:    form.value.venue_id,
    date:        form.value.date,
    start_time:  form.value.start_time || null,
    description: form.value.description || null,
  }

  if (editing.value) {
    await update.mutateAsync({ id: editing.value.id, payload })
  } else {
    await create.mutateAsync(payload)
  }
  cancelForm()
}

async function confirmDelete(concert: Concert) {
  if (!confirm(`Delete concert at ${concert.venue.name} on ${concert.date}?`)) return
  await remove.mutateAsync(concert.id)
}

const concerts = computed<Concert[]>(() => query.data.value ?? [])

const selectedVenue = computed(() =>
  venuesQuery.data.value?.find((v: Venue) => v.id === form.value.venue_id) ?? null,
)

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 900px; margin: 0 auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h1>Concert Schedule</h1>
      <button v-if="!showForm" @click="openCreate">+ Add concert</button>
    </div>

    <div v-if="showForm" style="border: 1px solid #444; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem;">
      <h2>{{ editing ? 'Edit concert' : 'New concert' }}</h2>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <label>
          Venue *
          <select v-model="form.venue_id" style="display: block; width: 100%; margin-top: 0.25rem;">
            <option :value="0" disabled>Select a venue</option>
            <option v-for="v in venuesQuery.data.value" :key="v.id" :value="v.id">{{ v.name }}</option>
          </select>
        </label>

        <div v-if="selectedVenue?.latitude !== null && selectedVenue?.latitude !== undefined">
          <p style="margin-bottom: 0.4rem; font-size: 0.9em;">{{ selectedVenue.name }}{{ selectedVenue.city ? ` — ${selectedVenue.city}` : '' }}</p>
          <VenueMap
            :latitude="selectedVenue.latitude"
            :longitude="selectedVenue.longitude"
            :editable="false"
          />
        </div>

        <div style="display: flex; gap: 1rem;">
          <label style="flex: 1;">
            Date *
            <input v-model="form.date" type="date" style="display: block; width: 100%; margin-top: 0.25rem;" />
          </label>
          <label style="flex: 1;">
            Start time
            <input v-model="form.start_time" type="time" style="display: block; width: 100%; margin-top: 0.25rem;" />
          </label>
        </div>

        <label>
          Description
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="A short description of the event…"
            style="display: block; width: 100%; margin-top: 0.25rem; resize: vertical;"
          />
        </label>

      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button :disabled="create.isPending.value || update.isPending.value" @click="submitForm">
          {{ editing ? 'Save changes' : 'Create concert' }}
        </button>
        <button @click="cancelForm">Cancel</button>
      </div>

      <p v-if="create.isError.value || update.isError.value" style="color: #f87171; margin-top: 0.5rem;">
        {{ (create.error.value ?? update.error.value)?.message }}
      </p>
    </div>

    <div v-if="query.isPending.value">Loading concerts…</div>
    <div v-else-if="query.isError.value">Failed to load concerts.</div>
    <div v-else-if="!query.data.value?.length" style="opacity: 0.6;">No concerts scheduled yet.</div>

    <div v-else style="display: flex; flex-direction: column; gap: 1rem;">
      <div
        v-for="concert in concerts"
        :key="concert.id"
        style="border: 1px solid #333; border-radius: 6px; padding: 1rem;"
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 600; font-size: 1.1em;">{{ formatDate(concert.date) }}</div>
            <div style="opacity: 0.7; margin-top: 0.2rem;">
              {{ concert.venue.name }}
              <span v-if="concert.doors_open"> · Doors {{ concert.doors_open }}</span>
              <span v-if="concert.start_time"> · Show {{ concert.start_time }}</span>
              <span v-if="concert.venue.city" style="font-size: 0.85em; margin-left: 0.4rem;">
                ({{ concert.venue.city }})
              </span>
            </div>
            <div v-if="concert.bands.length" style="margin-top: 0.3rem; font-size: 0.9em;">
              With: {{ concert.bands.map((b) => b.name).join(', ') }}
            </div>
            <div v-if="concert.description" style="margin-top: 0.5rem; font-size: 0.9em; opacity: 0.8;">
              {{ concert.description }}
            </div>
          </div>
          <div style="display: flex; gap: 0.25rem; flex-shrink: 0; margin-left: 1rem;">
            <button @click="openEdit(concert)">Edit</button>
            <button @click="confirmDelete(concert)">Delete</button>
          </div>
        </div>

        <div
          v-if="concert.venue.latitude !== null"
          style="margin-top: 0.75rem;"
        >
          <VenueMap
            :latitude="concert.venue.latitude"
            :longitude="concert.venue.longitude"
            :editable="false"
          />
        </div>
      </div>
    </div>
  </div>
</template>
