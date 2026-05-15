<script setup lang="ts">
import { ref } from 'vue'
import VenueMap from '@/components/map/VenueMap.vue'
import { useVenues } from '@/composables/useVenues'
import type { Venue } from '@/types/venue'

const { query, create, update, remove } = useVenues()

const editing = ref<Venue | null>(null)
const showForm = ref(false)

const form = ref({ name: '', latitude: null as number | null, longitude: null as number | null })

function openCreate() {
  editing.value = null
  form.value = { name: '', latitude: null, longitude: null }
  showForm.value = true
}

function openEdit(venue: Venue) {
  editing.value = venue
  form.value = { name: venue.name, latitude: venue.latitude, longitude: venue.longitude }
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editing.value = null
}

async function submitForm() {
  const payload = {
    name: form.value.name,
    latitude: form.value.latitude,
    longitude: form.value.longitude,
  }

  if (editing.value) {
    await update.mutateAsync({ id: editing.value.id, payload })
  } else {
    await create.mutateAsync(payload)
  }
  cancelForm()
}

async function confirmDelete(venue: Venue) {
  if (!confirm(`Delete "${venue.name}"?`)) return
  await remove.mutateAsync(venue.id)
}

function onMapClick(lat: number, lng: number) {
  form.value.latitude = lat
  form.value.longitude = lng
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 800px; margin: 0 auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h1>Venues</h1>
      <button v-if="!showForm" @click="openCreate">+ Add venue</button>
    </div>

    <div v-if="showForm" style="border: 1px solid #444; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem;">
      <h2>{{ editing ? 'Edit venue' : 'New venue' }}</h2>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <label>
          Name *
          <input v-model="form.name" type="text" placeholder="e.g. Rock Arena" style="display: block; width: 100%; margin-top: 0.25rem;" />
        </label>

        <div>
          <p style="margin-bottom: 0.5rem;">
            Location
            <span v-if="form.latitude !== null" style="font-size: 0.85em; opacity: 0.7;">
              ({{ form.latitude.toFixed(5) }}, {{ form.longitude?.toFixed(5) }})
            </span>
            <span v-else style="font-size: 0.85em; opacity: 0.7;"> — click map to set</span>
          </p>
          <VenueMap
            :latitude="form.latitude"
            :longitude="form.longitude"
            :editable="true"
            @update:coordinates="onMapClick"
          />
          <button
            v-if="form.latitude !== null"
            type="button"
            style="margin-top: 0.5rem; font-size: 0.85em;"
            @click="form.latitude = null; form.longitude = null"
          >
            Clear location
          </button>
        </div>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button :disabled="create.isPending.value || update.isPending.value" @click="submitForm">
          {{ editing ? 'Save changes' : 'Create venue' }}
        </button>
        <button @click="cancelForm">Cancel</button>
      </div>

      <p v-if="create.isError.value || update.isError.value" style="color: #f87171; margin-top: 0.5rem;">
        {{ (create.error.value ?? update.error.value)?.message }}
      </p>
    </div>

    <div v-if="query.isPending.value">Loading venues…</div>
    <div v-else-if="query.isError.value">Failed to load venues.</div>
    <div v-else-if="!query.data.value?.length" style="opacity: 0.6;">No venues yet.</div>

    <table v-else style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="text-align: left; border-bottom: 1px solid #444;">
          <th style="padding: 0.5rem;">Name</th>
          <th style="padding: 0.5rem;">City</th>
          <th style="padding: 0.5rem;">Street</th>
          <th style="padding: 0.5rem;"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="venue in query.data.value" :key="venue.id" style="border-bottom: 1px solid #2a2a2a;">
          <td style="padding: 0.5rem;">{{ venue.name }}</td>
          <td style="padding: 0.5rem; opacity: 0.7;">{{ venue.city ?? '—' }}</td>
          <td style="padding: 0.5rem; opacity: 0.7;">{{ [venue.street, venue.street_number].filter(Boolean).join(' ') || '—' }}</td>
          <td style="padding: 0.5rem; white-space: nowrap;">
            <button style="margin-right: 0.25rem;" @click="openEdit(venue)">Edit</button>
            <button @click="confirmDelete(venue)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
