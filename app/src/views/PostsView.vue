<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePosts } from '@/composables/usePosts'
import { useTags } from '@/composables/useTags'
import type { PostFilters } from '@/api/posts'

const router = useRouter()

const searchInput = ref('')
const selectedTag = ref<number | undefined>()
const page = ref(1)

watch([searchInput, selectedTag], () => { page.value = 1 })

const filters = computed<PostFilters>(() => ({
  search: searchInput.value || undefined,
  tag_id: selectedTag.value,
  page: page.value,
}))

const { query } = usePosts(filters)
const { query: tagsQuery } = useTags()

const posts = computed(() => query.data.value?.data ?? [])
const meta  = computed(() => query.data.value?.meta)

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 900px; margin: 0 auto;">
    <h1 style="margin-bottom: 1.5rem;">Blog</h1>

    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
      <input
        v-model="searchInput"
        type="search"
        placeholder="Search posts…"
        style="flex: 1; min-width: 200px;"
      />

      <select v-model="selectedTag" style="min-width: 150px;">
        <option :value="undefined">All tags</option>
        <option v-for="tag in tagsQuery.data.value" :key="tag.id" :value="tag.id">
          {{ tag.name }}
        </option>
      </select>
    </div>

    <div v-if="query.isPending.value">Loading posts…</div>
    <div v-else-if="query.isError.value">Failed to load posts.</div>
    <div v-else-if="!posts.length" style="opacity: 0.6;">
      {{ searchInput || selectedTag ? 'No posts match your filters.' : 'No posts yet.' }}
    </div>

    <div v-else style="display: flex; flex-direction: column; gap: 1.5rem;">
      <article
        v-for="post in posts"
        :key="post.id"
        style="border: 1px solid #ddd; border-radius: 6px; padding: 1rem;"
      >
        <h2 style="margin: 0 0 0.3rem;">
          <a
            style="color: inherit; text-decoration: none; cursor: pointer;"
            @click="router.push(`/posts/${post.id}`)"
          >{{ post.title }}</a>
        </h2>

        <div style="font-size: 0.85em; opacity: 0.6; margin-bottom: 0.5rem;">
          {{ formatDate(post.event_date ?? post.published_at) }}
        </div>

        <p v-if="post.excerpt" style="margin: 0 0 0.5rem; opacity: 0.8; font-size: 0.95em;">
          {{ post.excerpt }}
        </p>

        <div v-if="post.tags.length" style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
          <span
            v-for="tag in post.tags"
            :key="tag.id"
            style="font-size: 0.8em; padding: 0.1rem 0.4rem; border: 1px solid #ddd; border-radius: 3px; opacity: 0.7;"
          >{{ tag.name }}</span>
        </div>
      </article>
    </div>

    <!-- Pagination -->
    <div
      v-if="meta && meta.last_page > 1"
      style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 2rem;"
    >
      <button :disabled="page <= 1" @click="page--">← Prev</button>
      <span style="font-size: 0.9em; opacity: 0.6;">Page {{ page }} of {{ meta.last_page }}</span>
      <button :disabled="page >= meta.last_page" @click="page++">Next →</button>
    </div>
  </div>
</template>
