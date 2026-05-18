<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePost, usePosts } from '@/composables/usePosts'
import { useTags } from '@/composables/useTags'
import SingleImageUpload from '@/components/admin/forms/SingleImageUpload.vue'
import type { Post, PostLinkPayload, PostLinkType } from '@/types/post'

const route  = useRoute()
const router = useRouter()

const postId = computed(() => {
  const id = Number(route.params.id)
  return isNaN(id) ? null : id
})
const isEdit = computed(() => postId.value !== null)

const { create, update } = usePosts()
const postQuery = usePost(postId)
const { query: tagsQuery } = useTags()

// Form state
const title       = ref('')
const intro       = ref('')
const content     = ref('')
const image       = ref<string | null>(null)
const publishedAt = ref('')
const tagIds      = ref<number[]>([])
const links       = ref<PostLinkPayload[]>([])

// New link form
const newLinkType  = ref<PostLinkType>('youtube')
const newLinkUrl   = ref('')
const newLinkLabel = ref('')

const saving  = computed(() => create.isPending.value || update.isPending.value)
const apiError = computed(() => (create.error.value ?? update.error.value)?.message ?? null)

// Populate form when editing
watch(postQuery.data, (post: Post | undefined) => {
  if (!post) return
  title.value       = post.title
  intro.value       = post.intro ?? ''
  content.value     = post.content ?? ''
  image.value       = post.image
  publishedAt.value = post.published_at ? post.published_at.slice(0, 16) : ''
  tagIds.value      = post.tags.map((t) => t.id)
  links.value       = post.links.map(({ type, url, label }) => ({ type, url, label }))
}, { immediate: true })

function toggleTag(id: number) {
  const idx = tagIds.value.indexOf(id)
  if (idx === -1) tagIds.value.push(id)
  else tagIds.value.splice(idx, 1)
}

function addLink() {
  if (!newLinkUrl.value.trim()) return
  links.value.push({
    type:  newLinkType.value,
    url:   newLinkUrl.value.trim(),
    label: newLinkLabel.value.trim() || null,
  })
  newLinkUrl.value   = ''
  newLinkLabel.value = ''
}

function removeLink(idx: number) {
  links.value.splice(idx, 1)
}

async function submit() {
  const payload = {
    title:        title.value,
    intro:        intro.value || null,
    content:      content.value || null,
    image:        image.value,
    published_at: publishedAt.value || null,
    tag_ids:      tagIds.value,
    links:        links.value,
  }

  if (isEdit.value) {
    await update.mutateAsync({ id: postId.value!, payload })
  } else {
    await create.mutateAsync(payload)
  }
  router.push('/posts')
}

const LINK_TYPE_LABELS: Record<PostLinkType, string> = {
  youtube:   'YouTube',
  instagram: 'Instagram',
  facebook:  'Facebook',
  normal:    'Link',
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 800px; margin: 0 auto;">
    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
      <button @click="router.push('/posts')">← Back</button>
      <h1 style="margin: 0;">{{ isEdit ? 'Edit post' : 'New post' }}</h1>
    </div>

    <div v-if="isEdit && postQuery.isPending.value">Loading post…</div>

    <div v-else style="display: flex; flex-direction: column; gap: 1.25rem;">

      <label>
        Title *
        <input v-model="title" type="text" placeholder="Post title" style="display: block; width: 100%; margin-top: 0.25rem;" />
      </label>

      <label>
        Intro
        <textarea
          v-model="intro"
          rows="2"
          placeholder="Short introductory text shown in previews…"
          style="display: block; width: 100%; margin-top: 0.25rem; resize: vertical; font-family: inherit;"
        />
      </label>

      <label>
        Content
        <textarea
          v-model="content"
          rows="12"
          placeholder="Write your post here…"
          style="display: block; width: 100%; margin-top: 0.25rem; resize: vertical; font-family: inherit;"
        />
      </label>

      <div>
        <p style="margin-bottom: 0.4rem;">Image</p>
        <SingleImageUpload v-model="image" />
      </div>

      <label>
        Publish date &amp; time
        <input
          v-model="publishedAt"
          type="datetime-local"
          style="display: block; margin-top: 0.25rem;"
        />
        <small style="opacity: 0.6;">Leave blank to save as draft.</small>
      </label>

      <div v-if="tagsQuery.data.value?.length">
        <p style="margin-bottom: 0.4rem;">Tags</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          <label
            v-for="tag in tagsQuery.data.value"
            :key="tag.id"
            style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;"
          >
            <input
              type="checkbox"
              :checked="tagIds.includes(tag.id)"
              @change="toggleTag(tag.id)"
            />
            {{ tag.name }}
          </label>
        </div>
      </div>

      <div>
        <p style="margin-bottom: 0.75rem;">Links</p>

        <div v-if="links.length" style="margin-bottom: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <div
            v-for="(link, idx) in links"
            :key="idx"
            style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; border: 1px solid #333; border-radius: 4px;"
          >
            <span style="font-size: 0.8em; padding: 0.1rem 0.4rem; border: 1px solid #555; border-radius: 3px; flex-shrink: 0;">
              {{ LINK_TYPE_LABELS[link.type] }}
            </span>
            <span style="flex: 1; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              {{ link.label || link.url }}
            </span>
            <button style="flex-shrink: 0;" @click="removeLink(idx)">✕</button>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end;">
          <label style="display: flex; flex-direction: column; gap: 0.25rem;">
            Type
            <select v-model="newLinkType">
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="normal">Normal link</option>
            </select>
          </label>
          <label style="display: flex; flex-direction: column; gap: 0.25rem; flex: 2; min-width: 200px;">
            URL *
            <input v-model="newLinkUrl" type="url" placeholder="https://…" @keyup.enter="addLink" />
          </label>
          <label style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 120px;">
            Label
            <input v-model="newLinkLabel" type="text" placeholder="Optional label" @keyup.enter="addLink" />
          </label>
          <button type="button" style="flex-shrink: 0;" @click="addLink">Add</button>
        </div>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button :disabled="saving" @click="submit">
          {{ saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Publish post') }}
        </button>
        <button @click="router.push('/posts')">Cancel</button>
      </div>

      <p v-if="apiError" style="color: #555;">{{ apiError }}</p>
    </div>
  </div>
</template>
