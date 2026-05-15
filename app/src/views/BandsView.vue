<script setup lang="ts">
import { ref } from 'vue'
import { useBands } from '@/composables/useBands'
import type { Band } from '@/types/band'

const { query, create, update, remove } = useBands()

const editing = ref<Band | null>(null)
const showForm = ref(false)
const formName = ref('')

function openCreate() {
  editing.value = null
  formName.value = ''
  showForm.value = true
}

function openEdit(band: Band) {
  editing.value = band
  formName.value = band.name
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editing.value = null
}

async function submitForm() {
  if (editing.value) {
    await update.mutateAsync({ id: editing.value.id, payload: { name: formName.value } })
  } else {
    await create.mutateAsync({ name: formName.value })
  }
  cancelForm()
}

async function confirmDelete(band: Band) {
  if (!confirm(`Delete "${band.name}"?`)) return
  await remove.mutateAsync(band.id)
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 600px; margin: 0 auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h1>Bands</h1>
      <button v-if="!showForm" @click="openCreate">+ Add band</button>
    </div>

    <div v-if="showForm" style="border: 1px solid #444; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem;">
      <h2>{{ editing ? 'Edit band' : 'New band' }}</h2>

      <label>
        Name *
        <input
          v-model="formName"
          type="text"
          placeholder="e.g. Iron Fist"
          style="display: block; width: 100%; margin-top: 0.25rem;"
          @keyup.enter="submitForm"
        />
      </label>

      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button :disabled="create.isPending.value || update.isPending.value" @click="submitForm">
          {{ editing ? 'Save changes' : 'Create band' }}
        </button>
        <button @click="cancelForm">Cancel</button>
      </div>

      <p v-if="create.isError.value || update.isError.value" style="color: #f87171; margin-top: 0.5rem;">
        {{ (create.error.value ?? update.error.value)?.message }}
      </p>
    </div>

    <div v-if="query.isPending.value">Loading bands…</div>
    <div v-else-if="query.isError.value">Failed to load bands.</div>
    <div v-else-if="!query.data.value?.length" style="opacity: 0.6;">No bands yet.</div>

    <ul v-else style="list-style: none; padding: 0; margin: 0;">
      <li
        v-for="band in query.data.value"
        :key="band.id"
        style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #2a2a2a;"
      >
        <span>{{ band.name }}</span>
        <span>
          <button style="margin-right: 0.25rem;" @click="openEdit(band)">Edit</button>
          <button @click="confirmDelete(band)">Delete</button>
        </span>
      </li>
    </ul>
  </div>
</template>
