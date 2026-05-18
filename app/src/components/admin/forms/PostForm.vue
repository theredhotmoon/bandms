<script setup lang="ts">
import { reactive, watch } from 'vue'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import SingleImageUpload from '@/components/admin/forms/SingleImageUpload.vue'
import type { Post, PostPayload, PostLinkType } from '@/types/post'
import type { Tag } from '@/types/tag'
import type { Concert } from '@/types/concert'
import type { Album } from '@/types/album'
import type { ReleaseSummary } from '@/types/release'
import type { TourSummary } from '@/types/tour'
import type { MusicVideo } from '@/types/musicVideo'
import type { PressReleaseSummary } from '@/types/press-release'

const props = defineProps<{
  initial?: Post | null
  tags: Tag[]
  concerts: Concert[]
  albums: Album[]
  releases: ReleaseSummary[]
  tours: TourSummary[]
  musicVideos: MusicVideo[]
  pressReleases: PressReleaseSummary[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [PostPayload]; cancel: [] }>()

interface LinkRow { type: PostLinkType; url: string; label: string }

const form = reactive({
  title: '',
  intro: '',
  content: '',
  image: null as string | null,
  published_at: '',
  event_date: '',
  tag_ids: [] as number[],
  concert_ids: [] as number[],
  album_ids: [] as number[],
  release_ids: [] as number[],
  tour_ids: [] as number[],
  music_video_ids: [] as number[],
  press_release_ids: [] as number[],
  links: [] as LinkRow[],
})

watch(() => props.initial, (val) => {
  form.title = val?.title ?? ''
  form.intro = val?.intro ?? ''
  form.content = val?.content ?? ''
  form.image = val?.image ?? null
  form.published_at = val?.published_at ? val.published_at.slice(0, 16) : ''
  form.event_date = val?.event_date ?? ''
  form.tag_ids = val?.tags?.map(t => t.id) ?? []
  form.concert_ids = val?.concerts?.map(c => c.id) ?? []
  form.album_ids = val?.albums?.map(a => a.id) ?? []
  form.release_ids = val?.releases?.map(r => r.id) ?? []
  form.tour_ids = val?.tours?.map(t => t.id) ?? []
  form.music_video_ids = val?.music_videos?.map(v => v.id) ?? []
  form.press_release_ids = val?.press_releases?.map(pr => pr.id) ?? []
  form.links = val?.links?.map(l => ({ type: l.type, url: l.url, label: l.label ?? '' })) ?? []
}, { immediate: true })

function addLink() { form.links.push({ type: 'normal', url: '', label: '' }) }
function removeLink(i: number) { form.links.splice(i, 1) }

const linkTypes: PostLinkType[] = ['normal', 'youtube', 'instagram', 'facebook']

function submit() {
  emit('submit', {
    title: form.title,
    intro: form.intro || null,
    content: form.content || null,
    image: form.image || null,
    published_at: form.published_at || null,
    event_date: form.event_date || null,
    tag_ids: form.tag_ids,
    concert_ids: form.concert_ids,
    album_ids: form.album_ids,
    release_ids: form.release_ids,
    tour_ids: form.tour_ids,
    music_video_ids: form.music_video_ids,
    press_release_ids: form.press_release_ids,
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
      <label class="field-label">Intro</label>
      <textarea v-model="form.intro" class="field-input" rows="2" placeholder="Short introductory text shown in previews…" />
      <p v-if="errors?.intro" class="field-error">{{ errors.intro[0] }}</p>
    </div>
    <div>
      <label class="field-label">Content</label>
      <textarea v-model="form.content" class="field-input" rows="5" placeholder="Post content…" />
      <p v-if="errors?.content" class="field-error">{{ errors.content[0] }}</p>
    </div>
    <div>
      <label class="field-label">Image</label>
      <SingleImageUpload v-model="form.image" />
      <p v-if="errors?.image" class="field-error">{{ errors.image[0] }}</p>
    </div>
    <div class="flex gap-4">
      <div class="flex-1">
        <label class="field-label">Publish at</label>
        <input v-model="form.published_at" type="datetime-local" class="field-input" />
        <p v-if="errors?.published_at" class="field-error">{{ errors.published_at[0] }}</p>
      </div>
      <div class="flex-1">
        <label class="field-label">Event date</label>
        <input v-model="form.event_date" type="date" class="field-input" />
        <p v-if="errors?.event_date" class="field-error">{{ errors.event_date[0] }}</p>
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
      :musicVideos="musicVideos"
      :pressReleases="pressReleases"
      v-model:musicVideoIds="form.music_video_ids"
      v-model:pressReleaseIds="form.press_release_ids"
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
