<script setup lang="ts">
import { ref } from 'vue'
import { useTags } from '@/composables/useTags'
import type { Tag } from '@/types/tag'

const { query, create, update, remove } = useTags()

const editing = ref<Tag | null>(null)
const showForm = ref(false)
const formName = ref('')

function openCreate() {
  editing.value = null
  formName.value = ''
  showForm.value = true
}

function openEdit(tag: Tag) {
  editing.value = tag
  formName.value = tag.name
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

async function confirmDelete(tag: Tag) {
  if (!confirm(`Delete "${tag.name}"? It will be removed from all posts.`)) return
  await remove.mutateAsync(tag.id)
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 600px; margin: 0 auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h1>Tags</h1>
      <button v-if="!showForm" @click="openCreate">+ Add tag</button>
    </div>

    <div v-if="showForm" style="border: 1px solid #444; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem;">
      <h2>{{ editing ? 'Edit tag' : 'New tag' }}</h2>
      <label>
        Name *
        <input
          v-model="formName"
          type="text"
          placeholder="e.g. acoustic"
          style="display: block; width: 100%; margin-top: 0.25rem;"
          @keyup.enter="submitForm"
        />
      </label>
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button :disabled="create.isPending.value || update.isPending.value" @click="submitForm">
          {{ editing ? 'Save' : 'Create' }}
        </button>
        <button @click="cancelForm">Cancel</button>
      </div>
      <p v-if="create.isError.value || update.isError.value" style="color: #f87171; margin-top: 0.5rem;">
        {{ (create.error.value ?? update.error.value)?.message }}
      </p>
    </div>

    <div v-if="query.isPending.value">Loading…</div>
    <div v-else-if="query.isError.value">Failed to load tags.</div>
    <div v-else-if="!query.data.value?.length" style="opacity: 0.6;">No tags yet.</div>
    <ul v-else style="list-style: none; padding: 0; margin: 0;">
      <li
        v-for="tag in query.data.value"
        :key="tag.id"
        style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #2a2a2a;"
      >
        <span>{{ tag.name }} <small style="opacity: 0.5;">/{{ tag.slug }}</small></span>
        <span>
          <button style="margin-right: 0.25rem;" @click="openEdit(tag)">Edit</button>
          <button @click="confirmDelete(tag)">Delete</button>
        </span>
      </li>
    </ul>
  </div>
</template>
