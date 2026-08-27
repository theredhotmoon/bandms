<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import FaqEditor from '@/components/admin/FaqEditor.vue'
import { useFaqs } from '@/composables/useFaqs'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { ApiValidationError } from '@/api/client'
import type { Faq, FaqPayload } from '@/types/faq'

const { query, create, update, remove, reorder } = useFaqs()
const { query: modulesQuery } = useWebsiteModules()

const modules = computed(() => modulesQuery.data.value?.data ?? [])
const faqs = computed(() => query.data.value?.data ?? [])

// Which subpage's questions are on screen. Defaults to contact, the only module
// that ships with any.
const activeSlug = ref('contact')

const visible = computed(() =>
  faqs.value
    .filter((f) => f.module_slug === activeSlug.value)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
)

const countFor = (slug: string) => faqs.value.filter((f) => f.module_slug === slug).length

// ── Editing ───────────────────────────────────────────────────────────────────

/** id of the row being edited, 'new' while adding, or null. */
const editing = ref<number | 'new' | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const editingFaq = computed(() =>
  typeof editing.value === 'number' ? (faqs.value.find((f) => f.id === editing.value) ?? null) : null,
)

const pending = computed(() => create.isPending.value || update.isPending.value)

function startEdit(id: number | 'new') {
  editing.value = id
  fieldErrors.value = {}
}

function cancelEdit() {
  editing.value = null
  fieldErrors.value = {}
}

async function save(payload: FaqPayload) {
  fieldErrors.value = {}
  try {
    if (editing.value === 'new') {
      await create.mutateAsync(payload)
      toast.success('Question added')
    } else if (typeof editing.value === 'number') {
      await update.mutateAsync({ id: editing.value, payload })
      toast.success('Question saved')
    }
    // Follow the entry if it was moved to another subpage, so it does not
    // appear to vanish on save.
    if (payload.module_slug) activeSlug.value = payload.module_slug
    editing.value = null
  } catch (e) {
    // Field errors render next to the offending input; anything else would
    // vanish and leave the form looking like it saved.
    if (e instanceof ApiValidationError) fieldErrors.value = e.errors
    else toast.error('Could not save the question')
  }
}

async function destroy(faq: Faq) {
  const label = faq.question?.en || faq.question?.pl || 'this question'
  if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
  try {
    await remove.mutateAsync(faq.id)
    if (editing.value === faq.id) cancelEdit()
    toast.success('Question deleted')
  } catch {
    toast.error('Could not delete the question')
  }
}

function togglePublished(faq: Faq) {
  update.mutate({ id: faq.id, payload: { is_published: !faq.is_published } })
}

// ── Drag reorder, scoped to the active subpage ────────────────────────────────

let dragFrom = -1
const dragOverIndex = ref(-1)

function onDragStart(index: number, event: DragEvent) {
  dragFrom = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(toIndex: number, event: DragEvent) {
  event.preventDefault()
  dragOverIndex.value = -1
  if (dragFrom === -1 || dragFrom === toIndex) {
    dragFrom = -1
    return
  }

  const next = [...visible.value]
  const [moved] = next.splice(dragFrom, 1)
  next.splice(toIndex, 0, moved)
  dragFrom = -1

  reorder.mutate({ moduleSlug: activeSlug.value, ids: next.map((f) => f.id) })
}

function onDragEnd() {
  dragFrom = -1
  dragOverIndex.value = -1
}
</script>

<template>
  <AdminLayout>
    <div class="p-6 max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-bold text-white">FAQ</h1>
          <p class="text-sm text-zinc-500 mt-1">
            Questions are grouped by the subpage they appear on. A page with no questions
            shows no FAQ block at all.
          </p>
        </div>
        <button
          class="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          :disabled="editing === 'new'"
          @click="startEdit('new')"
        >
          + Add question
        </button>
      </div>

      <!-- Subpage tabs -->
      <div v-if="modules.length > 0" class="flex flex-wrap gap-1.5 mb-5">
        <button
          v-for="m in modules"
          :key="m.slug"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="
            activeSlug === m.slug
              ? 'bg-teal-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          "
          @click="activeSlug = m.slug"
        >
          {{ m.custom_name?.en || m.display_name }}
          <span
            class="ml-1.5"
            :class="activeSlug === m.slug ? 'text-teal-200' : 'text-zinc-600'"
          >{{ countFor(m.slug) }}</span>
        </button>
      </div>

      <div v-if="query.isLoading.value" class="text-zinc-500">Loading…</div>

      <div v-else-if="query.isError.value" class="text-red-400">
        Failed to load questions. Check the API connection.
      </div>

      <template v-else>
        <!-- New-entry form -->
        <div v-if="editing === 'new'" class="rounded-xl border border-teal-700 bg-zinc-900 overflow-hidden mb-3">
          <div class="px-4 py-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
            New question
          </div>
          <FaqEditor
            :faq="null"
            :module-slug="activeSlug"
            :modules="modules"
            :pending="pending"
            :errors="fieldErrors"
            @save="save"
            @cancel="cancelEdit"
          />
        </div>

        <p v-if="visible.length === 0 && editing !== 'new'" class="text-sm text-zinc-500 py-6">
          No questions for this subpage yet. Add one and it will appear in an FAQ block
          at the bottom of that page.
        </p>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="(faq, i) in visible"
            :key="faq.id"
            class="rounded-xl border bg-zinc-900 transition-colors overflow-hidden"
            :class="{
              'border-zinc-700': faq.is_published,
              'border-zinc-800': !faq.is_published,
              'border-t-2 border-t-teal-500': dragOverIndex === i,
            }"
          >
            <div
              class="flex items-center gap-3 px-4 py-3"
              draggable="true"
              @dragstart="onDragStart(i, $event)"
              @dragover="onDragOver(i, $event)"
              @drop="onDrop(i, $event)"
              @dragend="onDragEnd"
            >
              <span
                class="cursor-grab text-zinc-600 hover:text-zinc-400 active:cursor-grabbing flex-shrink-0"
                aria-hidden="true"
              >
                <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                  <circle cx="3" cy="2" r="1.5" /><circle cx="7" cy="2" r="1.5" />
                  <circle cx="3" cy="7" r="1.5" /><circle cx="7" cy="7" r="1.5" />
                  <circle cx="3" cy="12" r="1.5" /><circle cx="7" cy="12" r="1.5" />
                </svg>
              </span>

              <span class="w-5 text-center text-xs font-mono text-zinc-500 flex-shrink-0">{{ i + 1 }}</span>

              <div class="flex-1 min-w-0">
                <span
                  class="font-semibold text-sm block truncate"
                  :class="faq.is_published ? 'text-white' : 'text-zinc-500'"
                >{{ faq.question?.en || faq.question?.pl || '(untitled)' }}</span>
                <span v-if="!faq.question?.pl || !faq.question?.en" class="text-xs text-amber-500/80">
                  {{ faq.question?.en ? 'No Polish translation' : 'No English translation' }}
                </span>
              </div>

              <button
                class="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 transition-colors"
                :class="
                  faq.is_published
                    ? 'bg-teal-900 text-teal-300 hover:bg-teal-800'
                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                "
                :disabled="update.isPending.value"
                :title="faq.is_published ? 'Hide from the public site' : 'Show on the public site'"
                @click="togglePublished(faq)"
              >
                {{ faq.is_published ? 'Live' : 'Draft' }}
              </button>

              <button
                class="flex-shrink-0 p-1 rounded transition-colors"
                :class="editing === faq.id ? 'text-teal-400' : 'text-zinc-600 hover:text-zinc-400'"
                :aria-label="`Edit question ${i + 1}`"
                @click="editing === faq.id ? cancelEdit() : startEdit(faq.id)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>

              <button
                class="flex-shrink-0 p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"
                :aria-label="`Delete question ${i + 1}`"
                :disabled="remove.isPending.value"
                @click="destroy(faq)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                </svg>
              </button>
            </div>

            <FaqEditor
              v-if="editing === faq.id"
              :faq="editingFaq"
              :module-slug="faq.module_slug"
              :modules="modules"
              :pending="pending"
              :errors="fieldErrors"
              @save="save"
              @cancel="cancelEdit"
            />
          </div>
        </div>
      </template>
    </div>
  </AdminLayout>
</template>
