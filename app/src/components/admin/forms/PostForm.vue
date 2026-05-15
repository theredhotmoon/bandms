<script setup lang="ts">
import { reactive, watch } from 'vue'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import type { Post, PostPayload, PostLinkType } from '@/types/post'
import type { Category } from '@/types/category'
import type { Tag } from '@/types/tag'
import type { Concert } from '@/types/concert'
import type { Album } from '@/types/album'
import type { ReleaseSummary } from '@/types/release'
import type { TourSummary } from '@/types/tour'

const props = defineProps<{
  initial?: Post | null
  categories: Category[]
  tags: Tag[]
  concerts: Concert[]
  albums: Album[]
  releases: ReleaseSummary[]
  tours: TourSummary[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [PostPayload]; cancel: [] }>()

interface LinkRow { type: PostLinkType; url: string; label: string }

const form = reactive({
  title: '',
  content: '',
  image: '',
  published_at: '',
  category_ids: [] as number[],
  tag_ids: [] as number[],
  concert_ids: [] as number[],
  album_ids: [] as number[],
  release_ids: [] as number[],
  tour_ids: [] as number[],
  links: [] as LinkRow[],
})

watch(() => props.initial, (val) => {
  form.title = val?.title ?? ''
  form.content = val?.content ?? ''
  form.image = val?.image ?? ''
  form.published_at = val?.published_at ? val.published_at.slice(0, 16) : ''
  form.category_ids = val?.categories?.map(c => c.id) ?? []
  form.tag_ids = val?.tags?.map(t => t.id) ?? []
  form.concert_ids = val?.concerts?.map(c => c.id) ?? []
  form.album_ids = val?.albums?.map(a => a.id) ?? []
  form.release_ids = val?.releases?.map(r => r.id) ?? []
  form.tour_ids = val?.tours?.map(t => t.id) ?? []
  form.links = val?.links?.map(l => ({ type: l.type, url: l.url, label: l.label ?? '' })) ?? []
}, { immediate: true })

function toggleId(arr: number[], id: number) {
  const idx = arr.indexOf(id)
  if (idx === -1) arr.push(id)
  else arr.splice(idx, 1)
}

function addLink() { form.links.push({ type: 'normal', url: '', label: '' }) }
function removeLink(i: number) { form.links.splice(i, 1) }

const linkTypes: PostLinkType[] = ['normal', 'youtube', 'instagram', 'facebook']

function submit() {
  emit('submit', {
    title: form.title,
    content: form.content || null,
    image: form.image || null,
    published_at: form.published_at || null,
    category_ids: form.category_ids,
    tag_ids: form.tag_ids,
    concert_ids: form.concert_ids,
    album_ids: form.album_ids,
    release_ids: form.release_ids,
    tour_ids: form.tour_ids,
    links: form.links.map((l) => ({ type: l.type, url: l.url, label: l.label || null })),
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">Title <span style="color:#f87171;">*</span></label>
      <input v-model="form.title" required class="field-input" placeholder="Post title" />
      <p v-if="errors?.title" class="field-error">{{ errors.title[0] }}</p>
    </div>
    <div>
      <label class="field-label">Content</label>
      <textarea v-model="form.content" class="field-input" rows="5" placeholder="Post content…" />
      <p v-if="errors?.content" class="field-error">{{ errors.content[0] }}</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="field-label">Image URL</label>
        <input v-model="form.image" class="field-input" placeholder="https://…" />
        <p v-if="errors?.image" class="field-error">{{ errors.image[0] }}</p>
      </div>
      <div>
        <label class="field-label">Publish at</label>
        <input v-model="form.published_at" type="datetime-local" class="field-input" />
        <p v-if="errors?.published_at" class="field-error">{{ errors.published_at[0] }}</p>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="field-label">Categories</label>
        <div class="checkbox-list">
          <label v-for="c in categories" :key="c.id" class="checkbox-item">
            <input type="checkbox" :checked="form.category_ids.includes(c.id)" @change="toggleId(form.category_ids, c.id)" />
            <span>{{ c.name }}</span>
          </label>
          <p v-if="!categories.length" class="text-xs" style="color:#475569;">None.</p>
        </div>
      </div>
    </div>

    <EntityRelationsPanel
      :concerts="concerts"
      :albums="albums"
      :releases="releases"
      :tours="tours"
      :tags="tags"
      v-model:concertIds="form.concert_ids"
      v-model:albumIds="form.album_ids"
      v-model:releaseIds="form.release_ids"
      v-model:tourIds="form.tour_ids"
      v-model:tagIds="form.tag_ids"
    />

    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="field-label mb-0">Links</label>
        <button type="button" @click="addLink" class="btn-add">+ Add link</button>
      </div>
      <div class="flex flex-col gap-2">
        <div v-for="(link, i) in form.links" :key="i" class="link-row">
          <select v-model="link.type" class="field-input" style="width:110px; flex-shrink:0;">
            <option v-for="t in linkTypes" :key="t" :value="t">{{ t }}</option>
          </select>
          <input v-model="link.url" class="field-input flex-1" placeholder="URL" required />
          <input v-model="link.label" class="field-input" style="width:120px; flex-shrink:0;" placeholder="Label" />
          <button type="button" @click="removeLink(i)" class="btn-remove" title="Remove">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
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
.link-row { display: flex; align-items: center; gap: 0.5rem; }
.btn-remove {
  display:flex; align-items:center; justify-content:center;
  width:1.75rem; height:1.75rem; border-radius:0.375rem; border:none;
  cursor:pointer; flex-shrink:0; background:#3f1212; color:#f87171;
  transition: background 120ms;
}
.btn-remove:hover { background:#5a1a1a; }
</style>
