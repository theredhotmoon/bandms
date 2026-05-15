<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PostLinkDisplay from '@/components/blog/PostLinkDisplay.vue'
import { usePost } from '@/composables/usePosts'
import { useAuth } from '@/composables/useAuth'
import type { Post } from '@/types/post'

const route  = useRoute()
const router = useRouter()
const { isLoggedIn } = useAuth()

const postId = computed(() => {
  const id = Number(route.params.id)
  return isNaN(id) ? null : id
})

const postQuery = usePost(postId)
const post = computed<Post | undefined>(() => postQuery.data.value)
const { isPending, isError } = postQuery

function formatDate(iso: string | null) {
  if (!iso) return 'Draft'
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 800px; margin: 0 auto;">
    <div style="margin-bottom: 1rem;">
      <button @click="router.push('/posts')">← Back to posts</button>
    </div>

    <div v-if="isPending">Loading…</div>
    <div v-else-if="isError">Post not found.</div>

    <article v-else-if="post">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <h1 style="margin: 0 0 0.4rem;">{{ post.title }}</h1>
          <div style="font-size: 0.9em; opacity: 0.6;">
            {{ formatDate(post.published_at) }}
          </div>
        </div>
        <button v-if="isLoggedIn" @click="router.push(`/posts/${post.id}/edit`)">Edit</button>
      </div>

      <img
        v-if="post.image"
        :src="post.image"
        alt="Post image"
        style="width: 100%; max-height: 500px; object-fit: cover; border-radius: 6px; margin-bottom: 1.5rem;"
      />

      <div style="line-height: 1.7; white-space: pre-wrap; margin-bottom: 1.5rem;">{{ post.content }}</div>

      <PostLinkDisplay :links="post.links" />

      <div v-if="post.tags.length" style="margin-top: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.4rem;">
        <span
          v-for="tag in post.tags"
          :key="tag.id"
          style="font-size: 0.85em; padding: 0.15rem 0.5rem; border: 1px solid #555; border-radius: 3px; opacity: 0.7;"
        >{{ tag.name }}</span>
      </div>

      <!-- Linked entities -->
      <div v-if="post.releases?.length || post.concerts?.length || post.tours?.length || post.albums?.length" style="margin-top: 2rem; border-top: 1px solid #333; padding-top: 1.5rem;">
        <div v-if="post.releases?.length" style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 0.5rem;">Music</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <span v-for="r in post.releases" :key="r.id" style="font-size: 0.82rem; padding: 0.25rem 0.625rem; border-radius: 0.375rem; background: #1e1b4b; color: #a5b4fc;">
              {{ r.title }} <span style="opacity:0.5; font-size:0.75em;">{{ r.type }}</span>
            </span>
          </div>
        </div>
        <div v-if="post.concerts?.length" style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 0.5rem;">Concerts</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <span v-for="c in post.concerts" :key="c.id" style="font-size: 0.82rem; padding: 0.25rem 0.625rem; border-radius: 0.375rem; background: #0f2a1e; color: #34d399;">
              {{ c.date }}<template v-if="c.venue"> — {{ c.venue.name }}</template>
            </span>
          </div>
        </div>
        <div v-if="post.tours?.length" style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 0.5rem;">Tours</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <span v-for="t in post.tours" :key="t.id" style="font-size: 0.82rem; padding: 0.25rem 0.625rem; border-radius: 0.375rem; background: #1a1a3a; color: #818cf8;">
              {{ t.name }}
            </span>
          </div>
        </div>
        <div v-if="post.albums?.length">
          <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 0.5rem;">Photo Albums</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <span v-for="a in post.albums" :key="a.id" style="font-size: 0.82rem; padding: 0.25rem 0.625rem; border-radius: 0.375rem; background: #1a1430; color: #c084fc;">
              {{ a.title }}
            </span>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>
