<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAlbum } from '@/composables/useAlbums'

const route  = useRoute()
const router = useRouter()

const albumId = computed(() => {
  const id = Number(route.params.id)
  return isNaN(id) ? null : id
})

const { data: album, isPending, isError } = useAlbum(albumId)

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<template>
  <div style="padding: 1.5rem; max-width: 1000px; margin: 0 auto;">
    <div style="margin-bottom: 1rem;">
      <button @click="router.push('/photos')">← Back to albums</button>
    </div>

    <div v-if="isPending">Loading…</div>
    <div v-else-if="isError">Album not found.</div>

    <article v-else-if="album">
      <h1 style="margin: 0 0 0.4rem;">{{ album.title }}</h1>
      <div style="font-size: 0.9em; opacity: 0.6; display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem;">
        <span v-if="album.taken_at">{{ formatDate(album.taken_at) }}</span>
        <span v-if="album.venue"> · {{ album.venue.name }}</span>
        <span v-if="album.concert"> · {{ album.concert.date }}</span>
        <span> · {{ album.photo_count }} photo{{ album.photo_count !== 1 ? 's' : '' }}</span>
      </div>

      <p v-if="album.description" style="line-height: 1.7; margin-bottom: 1.5rem; opacity: 0.8;">{{ album.description }}</p>

      <div v-if="album.photos.length" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem;">
        <div v-for="photo in album.photos" :key="photo.id" style="border-radius: 6px; overflow: hidden; aspect-ratio: 4/3; background: #111;">
          <img
            v-if="photo.image_url"
            :src="photo.image_url"
            :alt="photo.caption ?? ''"
            style="width: 100%; height: 100%; object-fit: cover; display: block;"
          />
        </div>
      </div>

      <div v-if="album.tags.length" style="margin-top: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.4rem;">
        <span v-for="tag in album.tags" :key="tag.id" style="font-size: 0.85em; padding: 0.15rem 0.5rem; border: 1px solid #555; border-radius: 3px; opacity: 0.7;">{{ tag.name }}</span>
      </div>
    </article>
  </div>
</template>
