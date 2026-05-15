<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCategories } from '@/composables/useCategories'
import { usePosts } from '@/composables/usePosts'
import { useTags } from '@/composables/useTags'
import { useAuth } from '@/composables/useAuth'
import type { PostFilters } from '@/api/posts'
import type { PostSummary } from '@/types/post'

const router = useRouter()
const { isLoggedIn } = useAuth()

const searchInput = ref('')
const selectedCategory = ref<number | undefined>()
const selectedTag = ref<number | undefined>()

const filters = computed<PostFilters>(() => ({
  search: searchInput.value || undefined,
  category_id: selectedCategory.value,
  tag_id: selectedTag.value,
}))

const { query, remove } = usePosts(filters)
const { query: categoriesQuery } = useCategories()
const { query: tagsQuery } = useTags()

function formatDate(iso: string | null) {
  if (!iso) return 'Draft'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function confirmDelete(post: PostSummary) {
  if (!confirm(`Delete "${post.title}"?`)) return
  await remove.mutateAsync(post.id)
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 900px; margin: 0 auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h1>Blog</h1>
      <button v-if="isLoggedIn" @click="router.push('/posts/new')">+ New post</button>
    </div>

    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
      <input
        v-model="searchInput"
        type="search"
        placeholder="Search posts…"
        style="flex: 1; min-width: 200px;"
      />

      <select v-model="selectedCategory" style="min-width: 150px;">
        <option :value="undefined">All categories</option>
        <option v-for="cat in categoriesQuery.data.value" :key="cat.id" :value="cat.id">
          {{ cat.name }}
        </option>
      </select>

      <select v-model="selectedTag" style="min-width: 150px;">
        <option :value="undefined">All tags</option>
        <option v-for="tag in tagsQuery.data.value" :key="tag.id" :value="tag.id">
          {{ tag.name }}
        </option>
      </select>
    </div>

    <div v-if="query.isPending.value">Loading posts…</div>
    <div v-else-if="query.isError.value">Failed to load posts.</div>
    <div v-else-if="!query.data.value?.length" style="opacity: 0.6;">
      {{ searchInput || selectedCategory || selectedTag ? 'No posts match your filters.' : 'No posts yet.' }}
    </div>

    <div v-else style="display: flex; flex-direction: column; gap: 1.5rem;">
      <article
        v-for="post in query.data.value"
        :key="post.id"
        style="border: 1px solid #333; border-radius: 6px; padding: 1rem;"
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <div style="flex: 1;">
            <h2 style="margin: 0 0 0.3rem;">
              <a
                style="color: inherit; text-decoration: none; cursor: pointer;"
                @click="router.push(`/posts/${post.id}`)"
              >{{ post.title }}</a>
            </h2>

            <div style="font-size: 0.85em; opacity: 0.6; margin-bottom: 0.5rem;">
              {{ formatDate(post.published_at) }}
              <span v-if="post.categories.length">
                · {{ post.categories.map((c) => c.name).join(', ') }}
              </span>
            </div>

            <p v-if="post.excerpt" style="margin: 0 0 0.5rem; opacity: 0.8; font-size: 0.95em;">
              {{ post.excerpt }}
            </p>

            <div v-if="post.tags.length" style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
              <span
                v-for="tag in post.tags"
                :key="tag.id"
                style="font-size: 0.8em; padding: 0.1rem 0.4rem; border: 1px solid #555; border-radius: 3px; opacity: 0.7;"
              >{{ tag.name }}</span>
            </div>
          </div>

          <div v-if="isLoggedIn" style="display: flex; gap: 0.25rem; flex-shrink: 0;">
            <button @click="router.push(`/posts/${post.id}/edit`)">Edit</button>
            <button @click="confirmDelete(post)">Delete</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
