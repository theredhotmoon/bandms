<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Band, BandPayload } from '@/types/band'
import type { AuthorSummary } from '@/types/author'

const props = defineProps<{
  initial?: Band | null
  loading?: boolean
  errors?: Record<string, string[]>
  /** Every author/contact on file — the pool this band's contacts are picked from. */
  authors: AuthorSummary[]
}>()

const emit = defineEmits<{ submit: [BandPayload]; cancel: [] }>()

const form = reactive<{ name: string; website: string }>({ name: '', website: '' })
const authorIds = ref<number[]>([])
const contactSearch = ref('')

watch(
  () => props.initial,
  (val) => {
    form.name       = val?.name ?? ''
    form.website    = val?.website ?? ''
    authorIds.value = val?.contacts?.map((c) => c.id) ?? []
    contactSearch.value = ''
  },
  { immediate: true },
)

/** A filter only earns its space once the list stops fitting on screen. */
const showContactSearch = computed(() => props.authors.length > 6)

const filteredAuthors = computed(() => {
  const q = contactSearch.value.trim().toLowerCase()
  if (!q) return props.authors
  return props.authors.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      (a.email ?? '').toLowerCase().includes(q) ||
      (a.phone ?? '').toLowerCase().includes(q),
  )
})

/**
 * Selected contacts stay visible even when the search filters them out —
 * otherwise ticking a box and then typing looks like the tick was lost.
 */
const selectedAuthors = computed(() =>
  props.authors.filter((a) => authorIds.value.includes(a.id)),
)

/**
 * Laravel reports a bad id as `author_ids.0`, not `author_ids`, so a plain
 * lookup renders nothing and the 422 is silent — the modal just sits there.
 */
const contactError = computed(() => {
  const errs = props.errors ?? {}
  const key = Object.keys(errs).find((k) => k === 'author_ids' || k.startsWith('author_ids.'))
  return key ? errs[key]?.[0] ?? null : null
})

function toggleAuthor(id: number) {
  const i = authorIds.value.indexOf(id)
  if (i === -1) authorIds.value.push(id)
  else authorIds.value.splice(i, 1)
}

function contactDetail(a: AuthorSummary): string {
  return a.email || a.phone || a.whatsapp || 'no contact details'
}

function submit() {
  emit('submit', {
    name: form.name,
    website: form.website || null,
    author_ids: authorIds.value,
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">Name <span style="color:#f87171;">*</span></label>
      <input v-model="form.name" required class="field-input" placeholder="Band name" />
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>

    <div>
      <label class="field-label">Website</label>
      <input v-model="form.website" type="url" class="field-input" placeholder="https://…" />
      <p v-if="errors?.website" class="field-error">{{ errors.website[0] }}</p>
    </div>

    <!-- Contact people -->
    <div>
      <label class="field-label">
        Contact people
        <span v-if="authorIds.length" class="contact-count">{{ authorIds.length }}</span>
      </label>

      <p v-if="!authors.length" class="contact-empty">
        No authors or contacts on file yet.
        <RouterLink :to="{ name: 'admin-authors' }" class="contact-link">Add one first</RouterLink>
        and it will show up here.
      </p>

      <template v-else>
        <p v-if="selectedAuthors.length" class="contact-chips">
          <span v-for="a in selectedAuthors" :key="a.id" class="contact-chip">
            {{ a.name }}
            <button type="button" class="chip-x" :aria-label="`Remove ${a.name}`" @click="toggleAuthor(a.id)">×</button>
          </span>
        </p>

        <input
          v-if="showContactSearch"
          v-model="contactSearch"
          type="text"
          class="field-input contact-search"
          placeholder="Search contacts…"
        />

        <div class="contact-list">
          <p v-if="!filteredAuthors.length" class="contact-none">No contacts match “{{ contactSearch }}”.</p>
          <label v-for="a in filteredAuthors" :key="a.id" class="contact-item">
            <input
              type="checkbox"
              class="contact-check"
              :checked="authorIds.includes(a.id)"
              @change="toggleAuthor(a.id)"
            />
            <span class="contact-name">{{ a.name }}</span>
            <span class="contact-meta">{{ contactDetail(a) }}</span>
          </label>
        </div>
      </template>

      <p v-if="contactError" class="field-error">{{ contactError }}</p>
    </div>

    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update' : 'Create') }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.contact-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 1.1rem; height: 1.1rem; margin-left: 0.375rem; padding: 0 0.3rem;
  border-radius: 9999px; background: #2a2a2a; color: #c0c0c0;
  font-size: 0.65rem; font-weight: 700;
}
.contact-empty { font-size: 0.75rem; color: #64748b; line-height: 1.5; }
.contact-link { color: #9ca3af; text-decoration: underline; }
.contact-link:hover { color: #e2e8f0; }

.contact-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.5rem; }
.contact-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.15rem 0.3rem 0.15rem 0.5rem; border-radius: 9999px;
  background: #1c2b22; border: 1px solid #166534; color: #34d399;
  font-size: 0.7rem; font-weight: 600;
}
.chip-x {
  border: none; background: none; color: #34d399; cursor: pointer;
  font-size: 0.85rem; line-height: 1; padding: 0 0.15rem;
}
.chip-x:hover { color: #f87171; }

.contact-search { margin-bottom: 0.4rem; }
.contact-list {
  max-height: 11rem; overflow-y: auto; padding: 0.25rem 0;
  border: 1px solid #222222; border-radius: 0.375rem; background: #0d0d0d;
}
.contact-none { font-size: 0.75rem; color: #475569; padding: 0.5rem 0.875rem; }
.contact-item {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.35rem 0.875rem; cursor: pointer; transition: background 80ms;
}
.contact-item:hover { background: #1a1a1a; }
.contact-check { accent-color: #888888; flex-shrink: 0; }
.contact-name { font-size: 0.78rem; color: #e2e8f0; flex-shrink: 0; }
.contact-meta {
  font-size: 0.7rem; color: #475569; margin-left: auto; padding-left: 0.75rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
</style>
