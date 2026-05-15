<script setup lang="ts">
import { ref } from 'vue'
import { useCategories } from '@/composables/useCategories'
import type { Category } from '@/types/category'

const { query, create, update, remove } = useCategories()

const editing = ref<Category | null>(null)
const showForm = ref(false)
const formName = ref('')

function openCreate() {
  editing.value = null
  formName.value = ''
  showForm.value = true
}

function openEdit(cat: Category) {
  editing.value = cat
  formName.value = cat.name
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

async function confirmDelete(cat: Category) {
  if (!confirm(`Delete "${cat.name}"? It will be removed from all posts.`)) return
  await remove.mutateAsync(cat.id)
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 600px; margin: 0 auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h1>Categories</h1>
      <button v-if="!showForm" @click="openCreate">+ Add category</button>
    </div>

    <div v-if="showForm" style="border: 1px solid #444; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem;">
      <h2>{{ editing ? 'Edit category' : 'New category' }}</h2>
      <label>
        Name *
        <input
          v-model="formName"
          type="text"
          placeholder="e.g. Tour Reports"
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
    <div v-else-if="query.isError.value">Failed to load categories.</div>
    <div v-else-if="!query.data.value?.length" style="opacity: 0.6;">No categories yet.</div>
    <ul v-else style="list-style: none; padding: 0; margin: 0;">
      <li
        v-for="cat in query.data.value"
        :key="cat.id"
        style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #2a2a2a;"
      >
        <span>{{ cat.name }} <small style="opacity: 0.5;">/{{ cat.slug }}</small></span>
        <span>
          <button style="margin-right: 0.25rem;" @click="openEdit(cat)">Edit</button>
          <button @click="confirmDelete(cat)">Delete</button>
        </span>
      </li>
    </ul>
  </div>
</template>
