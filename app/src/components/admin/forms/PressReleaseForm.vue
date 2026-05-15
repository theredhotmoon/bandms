<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { fetchMetaForUrl } from '@/api/press-releases'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import type { Concert } from '@/types/concert'
import type { Tag } from '@/types/tag'
import type { Album } from '@/types/album'
import type { ReleaseSummary } from '@/types/release'
import type { PostSummary } from '@/types/post'
import type { TourSummary } from '@/types/tour'
import type { PressRelease, PressReleaseMeta, PressReleasePayload } from '@/types/press-release'

const props = defineProps<{
  initial?: PressRelease | null
  loading?: boolean
  errors?: Record<string, string[]>
  concerts: Concert[]
  posts: PostSummary[]
  albums: Album[]
  releases: ReleaseSummary[]
  tours: TourSummary[]
  tags: Tag[]
}>()

const emit = defineEmits<{
  submit: [payload: PressReleasePayload]
  cancel: []
}>()

const { token } = useAuth()

// ── Form state ────────────────────────────────────────────────
const form = reactive({
  url:            '',
  og_title:       '',
  og_description: '',
  og_image:       '',
  og_site_name:   '',
  published_at:   '',
  featured:       false,
})

const concert_ids  = ref<number[]>([])
const post_ids     = ref<number[]>([])
const album_ids    = ref<number[]>([])
const release_ids  = ref<number[]>([])
const tour_ids     = ref<number[]>([])
const tag_ids      = ref<number[]>([])

watch(
  () => props.initial,
  (val) => {
    form.url            = val?.url ?? ''
    form.og_title       = val?.og_title ?? ''
    form.og_description = val?.og_description ?? ''
    form.og_image       = val?.og_image ?? ''
    form.og_site_name   = val?.og_site_name ?? ''
    form.published_at   = val?.published_at ? val.published_at.slice(0, 16) : ''
    form.featured       = val?.featured ?? false
    concert_ids.value   = val?.concerts?.map((c) => c.id) ?? []
    post_ids.value      = val?.posts?.map((p) => p.id) ?? []
    album_ids.value     = val?.albums?.map((a) => a.id) ?? []
    release_ids.value   = val?.releases?.map((r) => r.id) ?? []
    tour_ids.value      = val?.tours?.map((t) => t.id) ?? []
    tag_ids.value       = val?.tags?.map((t) => t.id) ?? []
    metaPreview.value   = null
    fetchError.value    = ''
  },
  { immediate: true },
)

// ── Meta fetch ────────────────────────────────────────────────
const fetching     = ref(false)
const fetchError   = ref('')
const metaPreview  = ref<PressReleaseMeta | null>(null)
const previewImage = ref<string | null>(null)

async function fetchMeta() {
  if (!form.url || !token.value) return
  fetching.value   = true
  fetchError.value = ''
  try {
    const meta = await fetchMetaForUrl(token.value, form.url)
    metaPreview.value = meta
    if (meta.og_title)       form.og_title       = meta.og_title
    if (meta.og_description) form.og_description = meta.og_description
    if (meta.og_image)       form.og_image       = meta.og_image
    if (meta.og_site_name)   form.og_site_name   = meta.og_site_name
    previewImage.value = meta.og_image
  } catch (e: unknown) {
    fetchError.value = e instanceof Error ? e.message : 'Failed to fetch'
  } finally {
    fetching.value = false
  }
}

watch(() => form.og_image, (url) => { previewImage.value = url || null })

function submit() {
  emit('submit', {
    url:            form.url,
    og_title:       form.og_title || null,
    og_description: form.og_description || null,
    og_image:       form.og_image || null,
    og_site_name:   form.og_site_name || null,
    published_at:   form.published_at || null,
    featured:       form.featured,
    concert_ids:    concert_ids.value,
    post_ids:       post_ids.value,
    album_ids:      album_ids.value,
    release_ids:    release_ids.value,
    tour_ids:       tour_ids.value,
    tag_ids:        tag_ids.value,
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-5">

    <!-- URL + fetch -->
    <div>
      <label class="field-label">Article URL <span style="color:#f87171;">*</span></label>
      <div class="url-row">
        <input
          v-model="form.url"
          type="url"
          required
          class="field-input flex-1"
          placeholder="https://example.com/article-about-the-band"
        />
        <button
          type="button"
          class="btn-fetch"
          :disabled="!form.url || fetching"
          @click="fetchMeta"
        >
          {{ fetching ? 'Fetching…' : 'Fetch preview' }}
        </button>
      </div>
      <p v-if="fetchError" class="field-error">{{ fetchError }}</p>
      <p v-if="errors?.url" class="field-error">{{ errors.url[0] }}</p>
    </div>

    <!-- OG preview card -->
    <div v-if="form.og_title || previewImage" class="og-preview">
      <img
        v-if="previewImage"
        :src="previewImage"
        class="og-img"
        alt=""
        @error="previewImage = null"
      />
      <div class="og-body">
        <div v-if="form.og_site_name" class="og-site">{{ form.og_site_name }}</div>
        <div class="og-title">{{ form.og_title || '(no title)' }}</div>
        <div v-if="form.og_description" class="og-desc">{{ form.og_description }}</div>
      </div>
    </div>

    <!-- Editable meta fields -->
    <div class="grid grid-cols-2 gap-3">
      <div class="col-span-2">
        <label class="field-label">Title</label>
        <input v-model="form.og_title" class="field-input" placeholder="Article headline" />
      </div>
      <div>
        <label class="field-label">Site name</label>
        <input v-model="form.og_site_name" class="field-input" placeholder="e.g. Rolling Stone" />
      </div>
      <div>
        <label class="field-label">Image URL</label>
        <input v-model="form.og_image" type="url" class="field-input" placeholder="https://…" />
      </div>
      <div class="col-span-2">
        <label class="field-label">Description</label>
        <textarea v-model="form.og_description" class="field-input" rows="3" placeholder="Short article description" />
      </div>
    </div>

    <!-- Published at -->
    <div>
      <label class="field-label">Publish date</label>
      <input v-model="form.published_at" type="datetime-local" class="field-input" style="max-width:18rem;" />
    </div>

    <!-- Associations + Tags -->
    <EntityRelationsPanel
      :concerts="concerts"
      :posts="posts"
      :albums="albums"
      :releases="releases"
      :tours="tours"
      :tags="tags"
      v-model:concertIds="concert_ids"
      v-model:postIds="post_ids"
      v-model:albumIds="album_ids"
      v-model:releaseIds="release_ids"
      v-model:tourIds="tour_ids"
      v-model:tagIds="tag_ids"
    />

    <!-- Featured on EPK -->
    <label class="featured-toggle">
      <input type="checkbox" v-model="form.featured" />
      <span class="featured-label">Feature on EPK</span>
      <span class="featured-hint">Shows this article in the Press section of your public EPK (up to 3 featured articles displayed).</span>
    </label>

    <!-- Actions -->
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update press release' : 'Add press release') }}
      </button>
    </div>

  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
/* ── URL row ─────────────────────────────────────────────────── */
.url-row    { display: flex; gap: 0.5rem; align-items: stretch; }
.btn-fetch {
  padding: 0 0.875rem; border-radius: 0.375rem; font-size: 0.78rem;
  font-weight: 600; cursor: pointer; background: #1e1b4b; white-space: nowrap;
  border: 1px solid #312e81; color: #a5b4fc; transition: background 100ms; flex-shrink: 0;
}
.btn-fetch:hover:not(:disabled) { background: #1e2040; }
.btn-fetch:disabled { opacity: 0.4; cursor: default; }

/* ── OG preview card ─────────────────────────────────────────── */
.og-preview {
  border: 1px solid #1e1a4a; border-radius: 0.5rem; overflow: hidden;
  display: flex; gap: 0; background: #0e0e26;
}
.og-img {
  width: 130px; flex-shrink: 0; object-fit: cover; background: #0f0f26;
  border-right: 1px solid #1e1a4a;
}
.og-body    { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; overflow: hidden; }
.og-site    { font-size: 0.68rem; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.05em; }
.og-title   { font-size: 0.875rem; font-weight: 600; color: #e2e8f0; line-height: 1.35; }
.og-desc    {
  font-size: 0.78rem; color: #64748b; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

/* ── Featured toggle ─────────────────────────────────────────── */
.featured-toggle {
  display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer;
  padding: 0.625rem 0.875rem; border-radius: 0.375rem;
  border: 1px solid #1e1a4a; background: #0e0e26;
}
.featured-toggle input[type="checkbox"] { margin-top: 0.1rem; flex-shrink: 0; accent-color: #6366f1; }
.featured-label { font-size: 0.8125rem; font-weight: 500; color: #e2e8f0; }
.featured-hint { font-size: 0.7rem; color: #475569; margin-left: auto; text-align: right; max-width: 22rem; line-height: 1.4; }

</style>
